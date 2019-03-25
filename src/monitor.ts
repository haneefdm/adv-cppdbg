import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession, InitializedEvent } from 'vscode-debugadapter';
import { resolve } from 'path';
import { domainToASCII } from 'url';

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
    private regnames: string[] = [] ;
    public initialized: boolean = false ;
    public onDidChangeTreeDataEmitter: vscode.EventEmitter<MyTreeNode | undefined> = new vscode.EventEmitter<MyTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<MyTreeNode | undefined> = this.onDidChangeTreeDataEmitter.event;
    items: MyTreeNode[] = [] ;

    constructor() {
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
        console.log('RegisterView got event');
    }

    private async _tryInitialize(names: string[], frameId: any, hint?: string) {
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
                    }
                }
            } catch(e) {
                console.log('_tryInitialize: expression ' + hint + ' failed: ', e);
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
            await this._tryInitialize(RegisterView.armRegs, frameId, 'lr');
            await this._tryInitialize(RegisterView.x64Regs, frameId);
            await this._tryInitialize(RegisterView.x32Regs, frameId);

            // We tried everything, still not good pretend like there are no registers and not
            // slow down future queries in a debug session.
            this.initialized = true;
       }
    }

    deInitialize() {
        this.regnames = [];
        this.items = [];
        this.initialized = false;     
    }

    async updateRegisters() {
        if (vscode.debug.activeDebugSession) {      // Make sure we still have a session
            // Wish I can skip this? I don't need a thread or frame id for global references but API demands it??
            let frameId = 0 ;
            try {
                const threads = await vscode.debug.activeDebugSession.customRequest('threads', {});
                const threadId = threads.threads[0].id;
                const sTrace = await vscode.debug.activeDebugSession.customRequest('stackTrace', { threadId: threadId });
                frameId = sTrace.stackFrames[0].id; 
            } catch (e) {
                console.log('updateRegisters threads/stackTrace query failed. Err = ', e);
                return;
            }

            await this.initialize(frameId);

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
        }
    }
}

export class MonitorDbgEvents {
    public isDebugSessionRunning : boolean = false;
    public myid : string = 'adv-cppdbg: MonitorDbgEvents';
    public registerProvider : RegisterView = new RegisterView();

    constructor(protected context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(this.onDebugStarted.bind(this)),
            vscode.debug.onDidTerminateDebugSession(this.onDebugTerminated.bind(this)),
            vscode.debug.onDidReceiveDebugSessionCustomEvent(this.onCustomEvent.bind(this)),
            vscode.window.registerTreeDataProvider('adv-cppdbg.registers', this.registerProvider)
        );
     }

    protected onDebugStarted(session: vscode.DebugSession) {
        this.isDebugSessionRunning = true;
        this.consoleLog('Debug Started');
    }

    protected onDebugTerminated(session: vscode.DebugSession) {
        this.isDebugSessionRunning = false;
        this.registerProvider.deInitialize();
        this.consoleLog('Debug Terminated');
    }

    protected onCustomEvent(ev: vscode.DebugSessionCustomEvent) {
        this.consoleLog('Debug Custom Event' + ev);
    }

    /* async getRegisters(text: string) {
        const session = vscode.debug.activeDebugSession;
        if (session && text) {      // Make sure we still have a session
            // The following gets me the right result
            const sTrace = await session.customRequest('stackTrace', { threadId: 1 });
            const frameId = sTrace.stackFrames[0].id; 

            const marker = 'RegQuery';
            console.time(marker);
            const arg : DebugProtocol.EvaluateArguments = {expression: '', frameId: frameId, context:'repl'};
            let ix = 0 ;
            for (let reg of MonitorDbgEvents.x64Regs) {
                arg.expression = '$' + reg ;
                const regval = await session.customRequest('evaluate', arg);
                this.registerProvider.items[ix++].value = regval.result;
                //console.log(reg + '=' + regval.result) ;
            }
            console.timeEnd(marker);
            this.registerProvider._onDidChangeTreeData.fire();
            console.log('Done listing registers');

            // The following does execute but the results are printed to screen rather than
            // returning the result
            // I tried many variations of arguments and contexts types
            // arg.expression = '-exec -data-list-register-values N';
            // session.customRequest('evaluate', arg).then((response) => {
            //      console.log(response.result); 
            // });
        }
    } */

    public sendRequest(req:string) {
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