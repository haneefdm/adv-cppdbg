//
// This file contains a tracker for a debug adapter that exists somewher else.
// We are interested in state change of the debugger
//
// Much of the code assumes we are tracking a C/C++ debugger
//

import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugAdapterTrackerFactory, DebugAdapterTracker } from 'vscode';
import { ConfigVars } from './config';

export enum DbgAdapterState {
    Unknown,
    Running,
    Stopped
}

export class CppDbgDebugAdapterTracker implements DebugAdapterTracker {
    private _dbgRunningState: DbgAdapterState = DbgAdapterState.Unknown;
    public get dbgRunningState(): DbgAdapterState {
        return this._dbgRunningState;
    }

    private _trackRegisterQueries: boolean = false;
    public get trackRegisterQueries(): boolean {
        return this._trackRegisterQueries;
    }
    public set trackRegisterQueries(value: boolean) {
        this._trackRegisterQueries = value;
        if (value === true) {
            // Clear any previously cached stuff
            this.trackedRegisterNames = [];
            this.trackedRegisterValues.clear();
        }
    }

    public trackedRegisterNames: string[] = [];
    public trackedRegisterValues = new Map<number,string>();
    public onStateChanged: vscode.EventEmitter<CppDbgDebugAdapterTracker>;
    constructor() {
        this.onStateChanged = new vscode.EventEmitter<CppDbgDebugAdapterTracker>();
    }

    protected _dbgSetRunningState(value: DbgAdapterState) {
        if (value !== this._dbgRunningState) {
            this._dbgRunningState = value;
            if (ConfigVars.debugLevel > 0) {
                console.log('CppDbgDebugAdapterTracker: state changed to ' + DbgAdapterState[value]);
            }
            this.onStateChanged.fire(this);
        }
    }

    /**
     * A session with the debug adapter is about to be started.
     */
    onWillStartSession?(): void {
        if (ConfigVars.debugLevel > 0) {
            console.log('onWillStartSession called');
        }
    }
    /**
     * The debug adapter is about to receive a Debug Adapter Protocol message from VS Code.
     */
    onWillReceiveMessage?(message: any): void {
        //if (message) {
        //    console.log('onWillReceiveMessage called ' + message.command);
        //}
    }
    /**
     * The debug adapter has sent a Debug Adapter Protocol message to VS Code.
     */
    onDidSendMessage?(_msg: any): void {
        const message = _msg as DebugProtocol.ProtocolMessage;
        if (!message) {
            if (ConfigVars.debugLevel > 0) {
                console.log('Huh?: arg is not a DebugProtocol.ProtocolMessage type? ' + JSON.stringify(_msg));
            }
            return;
        }
        switch (message.type) {
            case 'event': {
                this.handleDAEvent(message);
                break;
            }
            case 'response': {
                this.handleDAResponse(message);
                break;
            }
            default: {
                console.log('Unhandled Message type ' + message.type);
                break;
            }
        }
    }
    /**
     * The debug adapter session is about to be stopped.
     */
    onWillStopSession?(): void {
        if (ConfigVars.debugLevel > 0) {
            console.log('onWillStopSession called');
        }
    }
    /**
     * An error with the debug adapter has occurred.
     */
    onError?(error: Error): void {
        if (ConfigVars.debugLevel > 0) {
            console.log('onError called ' + error);
        }
    }
    /**
     * The debug adapter has exited with the given exit code or signal.
     */
    onExit?(code: number | undefined, signal: string | undefined): void {
        if (ConfigVars.debugLevel > 0) {
            console.log('onExit called code=' + code + ', signal=', signal);
        }
        this._dbgSetRunningState(DbgAdapterState.Unknown);
    }

    handleDAResponse(message: DebugProtocol.ProtocolMessage) : void {
        const rsp: DebugProtocol.Response = message as DebugProtocol.Response;
        //console.log('*** Got response for command: ' + rsp.command + ' Success:' + rsp.success);
        if (!rsp.success) {
            if (ConfigVars.debugLevel > 0) {
                console.log('****** Failed response, Details: ' + JSON.stringify(message));
            }
        }
        switch (rsp.command) {
            case 'launch':
            case 'continue':
            case 'next':
            case 'step': {
                if (rsp.success) {
                    this._dbgSetRunningState(DbgAdapterState.Running);
                }
                break;
            }
            case 'disconnect':
            case 'exited': {
                this._dbgSetRunningState(DbgAdapterState.Unknown);
                break;
            }
            case 'threads': {
                break;
            }
            case 'stackTrace': {
                break;
            }
            case 'scopes': {
                break;
            }
            case 'configurationDone': {
                break;
            }
            case 'setBreakpoints': {
                break;
            }
            case 'setFunctionBreakpoints': {
                break;
            }
            case 'setExceptionBreakpoints': {
                break;
            }
            case 'variables': {
                break;
            }
            case 'evaluate': {
                break;
            }
            case 'initialize': {
                break;
            }
            default: {
                if (ConfigVars.debugLevel > 0) {
                    console.log('*** Unhandled response command: ' + rsp.command);
                }
                break;
            }
        }
    }

    handleDAEvent(message: DebugProtocol.ProtocolMessage) : void {
        const ev: DebugProtocol.Event = message as DebugProtocol.Event;
        switch (ev.event) {
            case 'output': {
                const outEv: DebugProtocol.OutputEvent = ev as DebugProtocol.OutputEvent;
                if (this.trackRegisterQueries && outEv && outEv.body.category === 'stdout') {
                    this.parseRegisterQueries(outEv);
                }
                break;
            }
            case 'stopped': {
                this._dbgSetRunningState(DbgAdapterState.Stopped);
                const stoppedEvent = ev as DebugProtocol.StoppedEvent;
                if (ConfigVars.debugLevel > 0) {
                    console.log('Event: Stopped: Reason: ' + stoppedEvent.body.reason);
                    console.log('====> ' + JSON.stringify(ev));
                }
                break;
            }
            case 'continued': {
                this._dbgSetRunningState(DbgAdapterState.Running);
                // This is rarely called but track it anyway. See Protocol description
                const continuedEvent = ev as DebugProtocol.ContinuedEvent;
                if (ConfigVars.debugLevel > 0) {
                    console.log('Event: Continued: ' + JSON.stringify(ev));
                }
                break;
            }
            case 'initialized': {
                break;
            }
            case 'breakpoint': {
                break;
            }
            case 'thread': {
                break;
            }
            case 'terminated': {
                this._dbgSetRunningState(DbgAdapterState.Unknown);
                break;
            }
            default: {
                console.log('Unhandled Event type ' + ev.event + ', ' + ev);
                break;
            }
        }       
    }

    protected parseRegisterQueries(outEv: DebugProtocol.OutputEvent) {
        let outStr = outEv.body.output;
        const reg_vlues_key = 'register-values: ';
        const values_pos = outStr.indexOf(reg_vlues_key);
        if (values_pos >= 0) {
            //console.log('+++++ reg_values-full: ' + outStr);
            outStr = outStr.substr(reg_vlues_key.length + values_pos);
            let rexp = /\{[^}]*\}/g;
            const match = outStr.match(rexp);
            const reg_values = new Map<number,string>();
            if (match && (match.length > 0)) {
                rexp = /\{number=([0-9]+),value=([^}]*)\}/;
                match.forEach((pair) => {
                    const nv_match = pair.match(rexp);
                    if (nv_match) {
                        reg_values.set(+nv_match[1], nv_match[2]);
                    }
                });
            }

            this.trackedRegisterValues = reg_values;

            if (ConfigVars.debugLevel > 1) {
                for (let [key, value] of reg_values) {
                    console.log(key, value);
                }
            }
            outEv.body.output = '';
            return;
        }

        const reg_names_key = 'register-names: ';
        outStr = outEv.body.output;
        if (outStr.indexOf(reg_names_key) >= 0) {
            const rexp = /\[(.*)\]/;
            const match = outStr.match(rexp);
            if (match && (match.length === 2)) {
                this.trackedRegisterNames = match[1].split(',');
                if (ConfigVars.debugLevel > 1) {
                    console.log('+++++ Found-reg-names ' + JSON.stringify(this.trackedRegisterNames));
                }
            }
            outEv.body.output = '';
            return;
        }
    }
}

export class CppDbgAdapterTrackerFactory implements DebugAdapterTrackerFactory {
    public DATracker: CppDbgDebugAdapterTracker = new CppDbgDebugAdapterTracker();
    createDebugAdapterTracker(s: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return this.DATracker;
    }
}
