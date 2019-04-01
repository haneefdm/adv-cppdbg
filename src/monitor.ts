///
/// This is in no way production ready code and will be split up into
/// multiple re-usable files. It is currently a demo for what is possible.
/// Until we have proper APIs from VSCode, it is neither fully functional
/// *manual* refresh required, nor is it very efficient
///
import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
//import { DebugSession, InitializedEvent } from 'vscode-debugadapter';
import { CppDbgAdapterTrackerFactory, CppDbgDebugAdapterTracker, DbgAdapterState } from './da-tracker';
import { ConfigVars } from './config';

export class MyTreeNode extends vscode.TreeItem {
    value: string = ':-((';
    children : MyTreeNode[] = [] ;
    constructor(
        public readonly name: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,) {
        super(name, collapsibleState);
    }
}

export class RegisterView implements vscode.TreeDataProvider<MyTreeNode> {
    // I don't know what the set of registers are valid for a given cpu. and what we should actually
    // display. Hate this hardcoded stuff but this is what I got for now.
    static armRegs = [
        "r0","r1","r2","r3","r4","r5","r6","r7","r8","r9","r10","r11","r12","sp","lr","pc",
        "xpsr","msp","psp","primask","basepri","faultmask","control","fpscr","s0","s1","s2",
        "s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17",
        "s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31",
        "d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","d10","d11","d12","d13","d14","d15"
    ];
    static x64Regs = [
        "rax","rbx","rcx","rdx","rdi","rsi","rbp","rsp","r8","r9","r10","r11","r12","r13","r14","r15",
        "rip","rflags","cs","fs","gs","eax","ebx","ecx","edx","edi","esi","ebp","esp","r8d","r9d",
        "r10d","r11d","r12d","r13d","r14d","r15d","ax","bx","cx","dx","di","si","bp","sp","r8w",
        "r9w","r10w","r11w","r12w","r13w","r14w","r15w","ah","bh","ch","dh","al","bl","cl","dl","dil",
        "sil","bpl","spl","r8l","r9l","r10l","r11l","r12l","r13l","r14l","r15l","fctrl","fstat",
        "ftag","fop","fioff","fiseg","fooff","foseg","mxcsr","mxcsrmask","stmm0","stmm1","stmm2",
        "stmm3","stmm4","stmm5","stmm6","stmm7","ymm0","ymm1","ymm2","ymm3","ymm4","ymm5","ymm6",
        "ymm7","ymm8","ymm9","ymm10","ymm11","ymm12","ymm13","ymm14","ymm15","xmm0","xmm1","xmm2",
        "xmm3","xmm4","xmm5","xmm6","xmm7","xmm8","xmm9","xmm10","xmm11","xmm12","xmm13","xmm14",
        "xmm15","trapno","err","faultvaddr"
    ];
    static x32Regs = [
        "eax","ecx","edx","ebx","esp","ebp","esi","edi","eip",
        "eflags","cs","ss","ds","es","fs","gs"
    ];

    private orig_regnames: string[] = [];           // Original list of names as reported by GDB. Can have empty strings
    private regnames: string[] = [] ;               // non-empty names
    private regmap = new Map<string, number>();     // non-empty name to index in regnames/items
    public initialized: boolean = false ;
    public onDidChangeTreeDataEmitter: vscode.EventEmitter<MyTreeNode | undefined> = new vscode.EventEmitter<MyTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<MyTreeNode | undefined> = this.onDidChangeTreeDataEmitter.event;
    items: MyTreeNode[] = [] ;

    constructor(protected DAtracker: CppDbgDebugAdapterTracker) {
        this.onDidChangeTreeData(this.refresh.bind(this));
    }

    // override/interface
    getTreeItem(element: MyTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        element.label = element.name + ': ' + element.value;
        return element;
        //throw new Error("Method not implemented.");
    }

    // override/interface
    getChildren(element?: MyTreeNode | undefined): vscode.ProviderResult<MyTreeNode[]> {
        if (element) {
            return [] ;
        } else {
            //return this.items.map((e) => e);
            return this.items;
        }
    }

    refresh() {
        if (ConfigVars.debugLevel > 0) {
            console.log('RegisterView got event');
        }
    }

    private async _tryInitialize(names: string[], frameId: any, arch: string, hint?: string) {
        if (!this.initialized && vscode.debug.activeDebugSession) {
            hint = hint ? hint : names[0];
            hint = '$' + hint;
            const arg : DebugProtocol.EvaluateArguments = {expression: hint, frameId: frameId, context:'hover'};
            try {
                const regval = await vscode.debug.activeDebugSession.customRequest('evaluate', arg);
                if (regval.result) {
                    const val: string = regval.result;
                    if (!val.toLowerCase().includes('error')) {
                        this.regnames = names;
                        this.items = [];
                        for (let name of this.regnames) {
                            this.items.push(new MyTreeNode(name));
                        }
                        this.initialized = true;
                        console.log('adv-cppdbg: It looks like the CPU type is ' + arch + '.');
                    }
                }
            } catch(e) {
                console.log('adv-cppdbg: It does not appear to be an ' + arch + ' CPU type.');
            }
        }
    }

    async initialize(frameId: any) {
        /*
        * This method of initialization of valid register names is kind a crap.
        * If I could just ask the debugger for all valid registers then I don't have
        * to guess or hardcode anything. Given VSCode API, I have to guess
        */
       if  (!this.initialized)  {
            this.deInitialize() ;       // Just make sure
            if (vscode.debug.activeDebugSession) {
                this.DAtracker.trackRegisterQueries = true;
                const arg : DebugProtocol.EvaluateArguments = {expression: '', frameId: frameId, context:'hover'};
                arg.expression = '-exec -data-list-register-names';
                await vscode.debug.activeDebugSession.customRequest('evaluate', arg);
                this.orig_regnames = this.DAtracker.trackedRegisterNames;
                const len = this.orig_regnames.length;
                for (let i = 0; i < len; i++) {
                    const rname = this.orig_regnames[i];
                    if (rname !== '') {
                        this.regmap.set(rname, this.regnames.length);
                        this.regnames.push(rname);
                        this.items.push(new MyTreeNode(rname));
                        if (ConfigVars.debugLevel > 1) {
                            console.log(rname, i);
                        }
                    }
                }
            }
            this.initialized = true;
            return;

            /* NOT REACHED */
            /*
            if (vscode.debug.activeDebugSession) {
                await this._tryInitialize(RegisterView.armRegs, frameId, 'ARM', 'lr');
                await this._tryInitialize(RegisterView.x64Regs, frameId, 'x64');
                await this._tryInitialize(RegisterView.x32Regs, frameId, 'x32');
            }
            
            // We tried everything, still not good pretend like there are no registers and not
            // slow down future queries in a debug session.
            this.initialized = true;
            */
       }
    }

    deInitialize() {
        this.regmap.clear();
        this.orig_regnames = [];
        this.regnames = [];
        this.items = [];
        this.initialized = false;     
    }

    async updateRegisters() {
        if (this.initialized && (this.regnames.length === 0)) {
            return ;
        }

        if (vscode.debug.activeDebugSession) {      // Make sure we still have a session
            // Wish I can skip this? I don't need a thread or frame id for global references but API demands it??
            let frameId = 0 ;
            try {
                // Yeah, unfortunately, thread-ids do not always start at 1. They can be like 5000
                const threads = await vscode.debug.activeDebugSession.customRequest('threads', {});
                const threadId = threads.threads[0].id;
                const sTrace = await vscode.debug.activeDebugSession.customRequest('stackTrace', { threadId: threadId });
                frameId = sTrace.stackFrames[0].id; 
            } catch (e) {
                console.log('updateRegisters threads/stackTrace query failed. Err = ', e);
                return;
            }

            if  (!this.initialized)  {
                await this.initialize(frameId);
            }

            if (vscode.debug.activeDebugSession) {      // Make sure we still have a session
                const marker = 'RegQuery';
                if (ConfigVars.debugLevel > 0) {
                    console.time(marker);
                }

                this.DAtracker.trackRegisterQueries = true;
                const arg : DebugProtocol.EvaluateArguments = {expression: '', frameId: frameId, context:'hover'};
                arg.expression = '-exec -data-list-register-values N';
                await vscode.debug.activeDebugSession.customRequest('evaluate', arg);
                for (let [key, value] of this.DAtracker.trackedRegisterValues) {
                    const rname = this.orig_regnames[key];
                    const ix = this.regmap.get(rname);
                    if (ix !== undefined) {
                        this.items[ix].value = value;
                        if (ConfigVars.debugLevel > 1) {
                            console.log('RegNum=', key, 'RegName=', rname, 'value=', value, 'MapIx=', ix);
                        }
                    } else {
                        console.error('Error finding register value for reg=' + rname + ' ' + key);
                    }
                }
                this.DAtracker.trackRegisterQueries = false;
                if (ConfigVars.debugLevel > 0) {
                    console.timeEnd(marker);
                }
                this.onDidChangeTreeDataEmitter.fire();
                if (ConfigVars.debugLevel > 0) {
                    console.log('Done listing registers');
                }
                return;
            }

            /* NOT REACHED */
            /*
            const marker = 'RegQuery';
            console.time(marker);
            const arg : DebugProtocol.EvaluateArguments = {expression: '', frameId: frameId, context:'repl'};
            let ix = 0 ;
            for (let reg of this.regnames) {
                arg.expression = '$' + reg;
                let val = ':(';
                if (vscode.debug.activeDebugSession) {
                    const regval = await vscode.debug.activeDebugSession.customRequest('evaluate', arg);
                    if (regval.result) {
                        val = regval.result;
                    }
                }
                this.items[ix++].value = val;
            }
            console.timeEnd(marker);
            this.onDidChangeTreeDataEmitter.fire();
            console.log('Done listing registers');
            */
        }
    }
}

export class MonitorDbgEvents {
    public isDebugSessionRunning : boolean = false;
    public myid : string = 'adv-cppdbg: MonitorDbgEvents';
    public registerProvider : RegisterView;

    constructor(protected context: vscode.ExtensionContext) {
        const fac = new CppDbgAdapterTrackerFactory();
        vscode.debug.registerDebugAdapterTrackerFactory('cppdbg', fac);
        fac.DATracker.onStateChanged.event(this.onDebuggerStateChanged.bind(this));
        
        this.registerProvider = new RegisterView(fac.DATracker);

        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(this.onDebugStarted.bind(this)),
            vscode.debug.onDidTerminateDebugSession(this.onDebugTerminated.bind(this)),
            vscode.debug.onDidReceiveDebugSessionCustomEvent(this.onCustomEvent.bind(this)),
            vscode.window.registerTreeDataProvider('adv-cppdbg.registers', this.registerProvider)
        );
    }

    protected onDebugStarted(session: vscode.DebugSession) {
        this.isDebugSessionRunning = true;
        if (ConfigVars.debugLevel > 0) {
            this.consoleLog('Debug Started');
        }
   }

    protected onDebugTerminated(session: vscode.DebugSession) {
        this.isDebugSessionRunning = false;
        this.registerProvider.deInitialize();
        if (ConfigVars.debugLevel > 0) {
            this.consoleLog('Debug Terminated');
        }
    }

    protected onCustomEvent(ev: vscode.DebugSessionCustomEvent) {
        if (ConfigVars.debugLevel > 0) {
            this.consoleLog('Debug Custom Event' + ev);
        }
    }

    protected onDebuggerStateChanged(tracker: CppDbgDebugAdapterTracker) {
        if (!ConfigVars.disableRegisterView) {
            if (ConfigVars.debugLevel > 0) {
                console.log('Debugger Status Changed Event ', DbgAdapterState[tracker.dbgRunningState]);
            }
            if (tracker.dbgRunningState === DbgAdapterState.Stopped) {
                this.registerProvider.updateRegisters();
            }
        }
    }

    public sendRequest(req?:string) {
        if (this.isDebugSessionRunning) {
            this.registerProvider.updateRegisters();
        } else {
            this.consoleLog('Debug sendRequest only valid when debugger running');
        }
    }

    private consoleLog(msg: any) : void {
        console.log(this.myid + ': ' + msg);
    }
}