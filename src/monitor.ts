import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession } from 'vscode-debugadapter';

export class MonitorDbgEvents {
    public myid : string = 'adv-cpptools: MonitorDbgEvents';

    constructor(protected context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(this.onDebugStarted.bind(this)),
            vscode.debug.onDidTerminateDebugSession(this.onDebugTerminated.bind(this))
        );
     }

    protected onDebugStarted(session: vscode.DebugSession) {
        this.consoleLog('Debug Started');
    }

    protected onDebugTerminated(session: vscode.DebugSession) {
        this.consoleLog('Debug Terminated');
    }

    /* onDebugTerminated() {
        this.consoleLog('Debug Terminated');
    }

    onDebugStopped() {
        this.consoleLog('Debug Stopped');
    }
 */
    private consoleLog(msg: string) : void {
        console.log(this.myid + ': ' + msg);
    }
}