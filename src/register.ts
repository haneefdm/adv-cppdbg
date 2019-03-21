import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugSession } from 'vscode-debugadapter';

export enum NodeType {
    Fields,
    Terminal
}

export class ANode {
    public expanded : boolean;
    constructor(
        public lbl: string,
        public type: NodeType
    ) {
        this.expanded = false;
        let session = vscode.debug.activeDebugSession as unknown as DebugSession;
     }
}

export class CppDbgRegTreeNode extends vscode.TreeItem {
    constructor(
        public readonly lbl: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public contextValue: string,
        public node: ANode
    ) {
        super(lbl, collapsibleState);

        this.command = {
            command: 'adv-cppdbg.registers.selectedNode',
            arguments: [node],
            title: 'Selected Node'
        };
    }
}

export class CppDbgRegViewDataProvider implements vscode.TreeDataProvider<CppDbgRegTreeNode> {
    onDidChangeTreeData?: vscode.Event<CppDbgRegTreeNode | null | undefined> | undefined;    getTreeItem(element: CppDbgRegTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        throw new Error("Method not implemented.");
    }
    getChildren(element?: CppDbgRegTreeNode | undefined): vscode.ProviderResult<CppDbgRegTreeNode[]> {
        throw new Error("Method not implemented.");
    }
}

export class CppDbgRegisterView {

}