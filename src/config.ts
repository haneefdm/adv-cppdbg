import * as vscode from 'vscode';

export class ConfigVars {
    public static debugLevel : number = 2;
    public static disableRegisterView: boolean = false;

    static initConfigVars() : void {
        const configuration = vscode.workspace.getConfiguration('adv-cppdbg');
        if (configuration) {
            if (configuration.debugLevel !== undefined) {
                ConfigVars.debugLevel = configuration.debugLevel;
            }
            if (configuration.disableRegisterView !== undefined) {
                ConfigVars.disableRegisterView = configuration.disableRegisterView;
            }
        }
    }
}