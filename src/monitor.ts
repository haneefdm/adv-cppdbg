import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession } from 'vscode-debugadapter';
import { resolve } from 'path';
import { domainToASCII } from 'url';

export class MonitorDbgEvents {
    public isDebugSessionRunning : boolean = false;
    public myid : string = 'adv-cpptools: MonitorDbgEvents';

    constructor(protected context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(this.onDebugStarted.bind(this)),
            vscode.debug.onDidTerminateDebugSession(this.onDebugTerminated.bind(this)),
            vscode.debug.onDidReceiveDebugSessionCustomEvent(this.onCustomEvent.bind(this))
        );
     }

    protected onDebugStarted(session: vscode.DebugSession) {
        this.isDebugSessionRunning = true;
        this.consoleLog('Debug Started');
    }

    protected onDebugTerminated(session: vscode.DebugSession) {
        this.isDebugSessionRunning = false;
        this.consoleLog('Debug Terminated');
    }

    protected onCustomEvent(ev: vscode.DebugSessionCustomEvent) {
        this.consoleLog('Debug Custom Event' + ev);
    }

    static lastTextInput = "-exec -data-list-register-names";
    static noInput = true;
    static async getInput() : Promise<string> {
        if (MonitorDbgEvents.noInput) {
            return new Promise((resolve) => {resolve(MonitorDbgEvents.lastTextInput);});
        }

        let ret : string = '';
        let txt = await vscode.window.showInputBox({value: MonitorDbgEvents.lastTextInput, prompt: 'Enter debugger command'});
        if (!txt) {
            txt = 'ERR: no text';
        } else {
            MonitorDbgEvents.lastTextInput = txt;
            ret = txt;
            // Display a message box to the user
            vscode.window.showInformationMessage('Hello World! ' + txt);
            console.log("Command activated: Hello world " + txt);
        }
        return new Promise((resolve) => {resolve(ret);});
    }

    static async doIt(text: string) {
        const session = vscode.debug.activeDebugSession;
        if (session && text) {      // Make sure we still have a session
            // The following gets me the right result
            const sTrace = await session.customRequest('stackTrace', { threadId: 1 });
            const frameId = sTrace.stackFrames[0].id; 

            // The following does execute but the results are printed to screen rather than
            // returning the result
            const arg : DebugProtocol.EvaluateArguments = {expression: text, frameId: frameId};
            const response = await session.customRequest('evaluate', arg);
            console.log(response.result);
        }
    }

    public sendRequest(req:string) {
        if (this.isDebugSessionRunning) {
            MonitorDbgEvents.getInput().then((text) => {
                const session = vscode.debug.activeDebugSession;
                if (this.isDebugSessionRunning && session) {      // Make sure we still have a session
                    MonitorDbgEvents.doIt(text);
                }
            });
        } else {
            this.consoleLog('Debug sendRequest only valid when debugger running');
        }
    }

    private consoleLog(msg: any) : void {
        console.log(this.myid + ': ' + msg);
    }
}