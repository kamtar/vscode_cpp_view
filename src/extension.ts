import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {

    const cppViewProvider = new CppViewProvider();

    const treeView = vscode.window.createTreeView('cppView', { treeDataProvider: cppViewProvider });

    // Set the title of the TreeView based on the workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length === 1) {
        treeView.title = workspaceFolders[0].name + " cppView";
        treeView.description = workspaceFolders[0].uri.fsPath;
    } else if (vscode.workspace.name) {
        treeView.title = vscode.workspace.name+ " cppView";
    } else {
        treeView.title = 'Cpp View';
    }
   
    vscode.commands.registerCommand('cppView.openFile', (resource) => {
        vscode.window.showTextDocument(vscode.Uri.file(resource));
    });

    vscode.commands.registerCommand('cppView.newFile', async (element?: CppFile) => {
        let dir: string;
    
        if (element) {
            // If it's a file, use its parent directory; if it's a folder, use it directly
            dir = element.isDirectory ? element.fullPath : path.dirname(element.fullPath);
        } else {
            // Fallback to the root workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            dir = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
        }
    
        if (!dir) {
            vscode.window.showErrorMessage('Cannot determine directory for the new file.');
            return;
        }
    
        const fileName = await vscode.window.showInputBox({ prompt: 'Enter new file name' });
        if (fileName) {
            const filePath = path.join(dir, fileName);

            if(fs.existsSync(filePath)){
                vscode.window.showErrorMessage(`File already exists: ${filePath}`);
                return;
            }
            
            try {
                fs.writeFileSync(filePath, '');
                cppViewProvider.refresh();
                vscode.window.showTextDocument(vscode.Uri.file(filePath));
                vscode.window.showInformationMessage(`File created: ${filePath}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create file`);
            }
        }
    });

    vscode.commands.registerCommand('cppView.newFolder', async (element?: CppFile) => {
        let dir: string;
    
        if (element) {
            // If it's a file, use its parent directory; if it's a folder, use it directly
            dir = element.isDirectory ? element.fullPath : path.dirname(element.fullPath);
        } else {
            // Fallback to the root workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            dir = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
        }
    
        if (!dir) {
            vscode.window.showErrorMessage('Cannot determine directory for the new folder.');
            return;
        }
    
        const folderName = await vscode.window.showInputBox({ prompt: 'Enter new folder name' });
        if (folderName) {
            const folderPath = path.join(dir, folderName);
            
            if(fs.existsSync(folderPath)){
                vscode.window.showErrorMessage(`Folder already exists: ${folderPath}`);
                return;
            }

            try {
                fs.mkdirSync(folderPath);
                cppViewProvider.refresh();
                vscode.window.showInformationMessage(`Folder created: ${folderPath}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create Folder`);
            }
        }
    });

    vscode.commands.registerCommand('cppView.revealInFileExplorer', (element: CppFile) => {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(element.fullPath));
    });

    vscode.commands.registerCommand('cppView.pin', async (element: CppFile) => {
        if (!element || !element.fullPath) {
            vscode.window.showErrorMessage('Invalid CppFile element.');
            return;
        }

        const document = await vscode.workspace.openTextDocument(element.fullPath);
        const editor = await vscode.window.showTextDocument(document, {
            preview: false, // Ensures the tab is not a preview
            preserveFocus: false, // Focus moves to the newly opened tab
            viewColumn: vscode.ViewColumn.Active, // Open in the current active column
        });

        // Execute the internal pin command
        await vscode.commands.executeCommand('workbench.action.pinEditor');
    });


    
    vscode.commands.registerCommand('cppView.copy', async (element: CppFile) => {
        if (!element) {
            vscode.window.showErrorMessage('No file or folder selected to copy.');
            return;
        }
    
        try {
            const filePath = element.fullPath;
    
            // Determine the platform and execute the appropriate clipboard copy command
            if (os.platform() === 'win32') {
                // Windows: Use PowerShell to copy to clipboard
                const command = `powershell.exe Set-Clipboard -Path "${filePath}"`;
                child_process.execSync(command);
            } else if (os.platform() === 'darwin') {
                // macOS: Use pbcopy
                child_process.execSync(`cat "${filePath}" | pbcopy`, { shell: '/bin/bash' });
            } else if (os.platform() === 'linux') {
                // Linux: Use xclip or xsel (xclip must be installed)
                child_process.execSync(`xclip -selection clipboard -t application/octet-stream < "${filePath}"`, { shell: '/bin/bash' });
            } else {
                throw new Error('Unsupported platform');
            }
    
            vscode.window.showInformationMessage(`Copied file to clipboard: ${filePath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy file to clipboard`);
        }
    });
    
    vscode.commands.registerCommand('cppView.copyPath', async (element: CppFile) => {
        if (!element) {
            vscode.window.showErrorMessage('No file or folder selected to copy.');
            return;
        }
    
        try {
            // Copy the full path of the file or folder to the clipboard
            await vscode.env.clipboard.writeText(element.fullPath);
            vscode.window.showInformationMessage(`Copied path to clipboard: ${element.fullPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy path to clipboard`);
        }
    });

    vscode.commands.registerCommand('cppView.delete', async (element: CppFile) => {
        if (!element) {
            vscode.window.showErrorMessage('No file or folder selected to delete.');
            return;
        }
    
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete ${element.label}?`,
            { modal: true },
            'Yes'
        );
    
        if (confirm === 'Yes') {
            fs.rm(element.fullPath, { recursive: true }, (err) => { if(!err) {vscode.window.showInformationMessage(`Deleted: ${element.label}`);} else {vscode.window.showErrorMessage(`Failed to delete ${element.label}`);}});        
            cppViewProvider.refresh(); // Refresh the TreeView
        }
    });    

    vscode.commands.registerCommand('cppView.showGitDiff', async (element: CppFile) => {
        if (!element || element.isDirectory) {
            vscode.window.showErrorMessage('Please select a file to show git changes.');
            return;
        }

        try {
            // Get the file URI
            const fileUri = vscode.Uri.file(element.fullPath);
            
            // Try to use VS Code's built-in git commands to show changes
            // This will automatically open the diff view if the file has changes
            const success = await vscode.commands.executeCommand('git.openChange', fileUri);
            
            // If the built-in command doesn't work (returns undefined or false), try an alternative approach
            if (!success) {
                // Get the git repository containing the file
                const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
                if (!gitExtension) {
                    throw new Error('Git extension not available');
                }
                
                const api = gitExtension.getAPI(1);
                if (!api) {
                    throw new Error('Git API not available');
                }
                
                // Find the repository that contains this file
                const repositories = api.repositories;
                if (!repositories || repositories.length === 0) {
                    throw new Error('No Git repositories found');
                }
                
                // Check if file has changes in any repository
                let fileHasChanges = false;
                for (const repo of repositories) {
                    // Compare workspace path with repository path to find the right repo
                    const relativePath = path.relative(repo.rootUri.fsPath, element.fullPath);
                    if (!relativePath.startsWith('..')) {
                        // This is the correct repository
                        const changes = await repo.diffIndexWithHEAD(relativePath);
                        if (changes) {
                            fileHasChanges = true;
                            // Use the git.openChange command with repository context
                            await vscode.commands.executeCommand('git.openChange', fileUri, repo);
                            break;
                        }
                    }
                }
                
                if (!fileHasChanges) {
                    vscode.window.showInformationMessage(`No uncommitted changes for ${path.basename(element.fullPath)}`);
                }
            }
        } catch (error) {
            console.error('Error showing git diff:', error);
            vscode.window.showErrorMessage(`Failed to show git diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

export function deactivate() {}

class CppViewProvider implements vscode.TreeDataProvider<CppFile> {

    private _onDidChangeTreeData: vscode.EventEmitter<CppFile | undefined | void> = new vscode.EventEmitter<CppFile | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CppFile | undefined | void> = this._onDidChangeTreeData.event;

    private fileWatcher: vscode.FileSystemWatcher | undefined;


    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const pattern = new vscode.RelativePattern(workspaceFolders[0], '**/*');
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

            // Watch for changes, deletions, and additions
            this.fileWatcher.onDidChange(() => this.refresh());
            this.fileWatcher.onDidCreate(() => this.refresh());
            this.fileWatcher.onDidDelete(() => this.refresh());
        }
    }
    
    dispose(): void {
        if (this.fileWatcher) {
        this.fileWatcher.dispose();
    }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CppFile): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CppFile): Thenable<CppFile[]> {
        if (!element) {
            // Root level
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return Promise.resolve([]);
            }

            if (workspaceFolders.length === 1) {
                // Only one workspace folder
                // Return the children of that folder directly
                return Promise.resolve(this.getDirectoryChildren(workspaceFolders[0].uri.fsPath));
            } else {
                // Multiple workspace folders
                const result: CppFile[] = workspaceFolders.map(folder => {
                    const folderItem = new CppFile(folder.name, vscode.TreeItemCollapsibleState.Collapsed, folder.uri.fsPath, true);
                    return folderItem;
                });
                return Promise.resolve(result);
            }
        } else {
            // Element can be a directory or a file
            if (element.isDirectory) {
                // Return contents of the directory
                return Promise.resolve(this.getDirectoryChildren(element.fullPath));
            } else {
                // If element has children (header files), return them
                if (element.children) {
                    return Promise.resolve(element.children);
                } else {
                    return Promise.resolve([]);
                }
            }
        }
    }

    private getDirectoryChildren(dir: string): CppFile[] {
        let items: CppFile[] = [];

        let list: string[];
        try {
            list = fs.readdirSync(dir);
        } catch (err) {
            console.error(`Failed to read directory: ${dir}`, err);
            return items;
        }

        const files = list.map(file => path.join(dir, file));

        // Map from base name to source file
        let sourceFileMap: { [key: string]: CppFile } = {};

        // Map of header files in this directory
        let headerFilesInDir: { [name: string]: string } = {};

        files.forEach(fullPath => {
            let stat: fs.Stats;
            try {
                stat = fs.statSync(fullPath);
            } catch (err) {
                console.error(`Failed to stat file: ${fullPath}`, err);
                return;
            }

            const baseName = path.basename(fullPath);

            // Skip any file or directory named .git
            if (baseName === '.git') {
                return;
            }

            if (stat.isDirectory()) {
                const dirItem = new CppFile(baseName, vscode.TreeItemCollapsibleState.Collapsed, fullPath, true);
                items.push(dirItem);
            } else {
                const ext = path.extname(fullPath);
                const nameWithoutExt = path.basename(fullPath, ext);

                if (ext === '.cpp' || ext === '.c') {
                    const sourceItem = new CppFile(baseName, vscode.TreeItemCollapsibleState.None, fullPath, false);
                    sourceFileMap[nameWithoutExt] = sourceItem;
                    items.push(sourceItem);
                } else if (ext === '.h' || ext === '.hpp') {
                    headerFilesInDir[baseName] = fullPath;
                    // Do not add header files to items immediately
                    // They will be added under their source files if applicable
                } else {
                    // Other files
                    const fileItem = new CppFile(baseName, vscode.TreeItemCollapsibleState.None, fullPath, false);
                    items.push(fileItem);
                }
            }
        });

        // Associate header files with their source files
        Object.keys(sourceFileMap).forEach(sourceName => {
            const sourceItem = sourceFileMap[sourceName];

            let children: CppFile[] = [];

            // Check for headers with the same base name in the same directory
            const headerFileNameH = sourceName + '.h';
            const headerFileNameHPP = sourceName + '.hpp';

            if (headerFilesInDir[headerFileNameH]) {
                const headerItem = new CppFile(headerFileNameH, vscode.TreeItemCollapsibleState.None, headerFilesInDir[headerFileNameH], false);
                children.push(headerItem);
                // Remove the header file from headerFilesInDir to prevent it from being added to items later
                delete headerFilesInDir[headerFileNameH];
            }
            if (headerFilesInDir[headerFileNameHPP]) {
                const headerItem = new CppFile(headerFileNameHPP, vscode.TreeItemCollapsibleState.None, headerFilesInDir[headerFileNameHPP], false);
                children.push(headerItem);
                // Remove the header file from headerFilesInDir to prevent it from being added to items later
                delete headerFilesInDir[headerFileNameHPP];
            }

            // If no corresponding header file in same directory, parse the source file to find #include directives
            if (children.length === 0) {
                const includedHeaders = this.getIncludedHeaders(sourceItem.fullPath, sourceName);
                includedHeaders.forEach(headerName => {
                    // Try to find the header file in the workspace
                    const headerFullPath = this.findHeaderInWorkspace(headerName);
                    if (headerFullPath) {
                        const headerItem = new CppFile(headerName, vscode.TreeItemCollapsibleState.None, headerFullPath, false);
                        children.push(headerItem);
                    }
                });
            }

            if (children.length > 0) {
                sourceItem.children = children;
                sourceItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        });

        // Now add any remaining header files in the directory to items
        Object.keys(headerFilesInDir).forEach(headerFileName => {
            const headerFullPath = headerFilesInDir[headerFileName];
            const headerItem = new CppFile(headerFileName, vscode.TreeItemCollapsibleState.None, headerFullPath, false);
            items.push(headerItem);
        });

        // Sort items according to the specified order
        items.sort((a, b) => {
            const getSortOrder = (item: CppFile): number => {
                if (item.isDirectory) {
                    return 0;
                }
                const ext = path.extname(item.fullPath).toLowerCase();
                if (ext === '.cpp' || ext === '.c') {
                    return 1;
                }
                if (ext === '.hpp' || ext === '.h') {
                    return 2;
                }
                return 3; // Other files
            };

            const orderA = getSortOrder(a);
            const orderB = getSortOrder(b);

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.label.localeCompare(b.label);
        });

        return items;
    }

    private getIncludedHeaders(sourceFilePath: string, sourceName: string): string[] {
        // Read the first few lines of the source file to find #include directives
        try {
            const data = fs.readFileSync(sourceFilePath, 'utf8');
            const lines = data.split('\n').slice(0, 50); // Read first 50 lines
            const headers: string[] = [];
            const includeRegex = /^\s*#include\s*[<"](.+)[">]/;
            for (let line of lines) {
                const match = line.match(includeRegex);
                if (match) {
                    const headerName = match[1];
                    // Only consider headers with the same base name as the source file
                    const headerBaseName = path.basename(headerName, path.extname(headerName));
                    if (headerBaseName === sourceName && (headerName.endsWith('.h') || headerName.endsWith('.hpp'))) {
                        headers.push(headerName);
                    }
                }
            }
            return headers;
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    private findHeaderInWorkspace(headerName: string): string | null {
        // Search for the header file in the workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        for (const folder of workspaceFolders) {
            const headerPath = this.findHeaderInFolder(folder.uri.fsPath, headerName);
            if (headerPath) {
                return headerPath;
            }
        }

        return null;
    }

    private findHeaderInFolder(folderPath: string, headerName: string): string | null {
        // Skip any file or directory named .git
        if (path.basename(folderPath) === '.git') {
            return null;
        }

        let files: string[];
        try {
            files = fs.readdirSync(folderPath);
        } catch (err) {
            console.error(`Failed to read directory: ${folderPath}`, err);
            return null;
        }

        for (const file of files) {
            const fullPath = path.join(folderPath, file);
            let stat: fs.Stats;
            try {
                stat = fs.statSync(fullPath);
            } catch (err) {
                console.error(`Failed to stat file: ${fullPath}`, err);
                continue;
            }

            const baseName = path.basename(fullPath);

            // Skip any file or directory named .git
            if (baseName === '.git') {
                continue;
            }

            if (stat.isDirectory()) {
                const found = this.findHeaderInFolder(fullPath, headerName);
                if (found) {
                    return found;
                }
            } else {
                if (baseName === path.basename(headerName)) {
                    return fullPath;
                }
            }
        }
        return null;
    }

}

class CppFile extends vscode.TreeItem {

    children: CppFile[] | undefined;
    isDirectory: boolean;

    constructor(
        public readonly label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly fullPath: string,
        isDirectory: boolean,
    ) {
        super(label, collapsibleState);
        this.isDirectory = isDirectory;

        this.tooltip = `${this.fullPath}`;
        this.description = '';

        if (isDirectory) {
            // Distinguish folders by icon
            this.iconPath = new vscode.ThemeIcon('folder');
        } else {
            // Remove icons from files
            this.iconPath = vscode.ThemeIcon.File;

            // Set resourceUri to enable VSCode's default file icons and colors
            this.resourceUri = vscode.Uri.file(this.fullPath);

            // Assign command to open file when clicked
            this.command = {
                command: 'cppView.openFile',
                title: 'Open File',
                arguments: [this.fullPath]
            };
        }
    }

    contextValue = 'cppFile';
}
