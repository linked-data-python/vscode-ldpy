import * as vscode from 'vscode';

function updateTreeViewItems() {
    const files = vscode.workspace.findFiles('**/*.ldpy');
    files.then((uriArray) => {
      uriArray.forEach(uri => {
        const treeItem = treeDataProvider.getTreeItem(uri);
        if (treeItem) {
          treeItem.contextValue = 'xpy-file';
        }
      });
    });
  }

function activate(context) {
  // Register the tree view and data provider
  treeDataProvider = new MyTreeDataProvider();
  vscode.window.registerTreeDataProvider('myTreeView', treeDataProvider);

  // Update the tree view items initially
  updateTreeViewItems();

  // Watch for changes to the workspace and update the tree view items accordingly
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    updateTreeViewItems();
  });
  vscode.workspace.onDidCreateFiles((event) => {
    const xpyFiles = event.files.filter((file) => {
      return file.path.endsWith('.ldpy');
    });
    if (xpyFiles.length > 0) {
      updateTreeViewItems();
    }
  });
}