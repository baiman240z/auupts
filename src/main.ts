import electron, {IpcMainEvent} from "electron";
import fs from "fs";
import {Campaign} from "./classes/campaign";

let win: electron.BrowserWindow;

electron.app.on('window-all-closed', () => {
    if (process.platform != 'darwin') {
        electron.app.quit();
    }
});

electron.app.on('ready', () => {
    win = new electron.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {nodeIntegration: true}
    });

    win.loadURL(`file://${__dirname}/../index.html`).then();
    win.on('closed', () => {
        win.destroy();
    });
});

electron.ipcMain.on('clear', (e: IpcMainEvent) => {
    Campaign.clear();
    e.sender.send('find-campaign');
    e.sender.send('show-message', '削除しました', 'success');
});

electron.ipcMain.on('unzip', (e: IpcMainEvent, file: string) => {
    e.sender.send('show-message', '解凍中......', 'success', false);
    Campaign.unzip(file, () => {
        e.sender.send('find-campaign');
        e.sender.send('show-message', '解凍しました', 'success');
    });
});

electron.ipcMain.on('save', (e: IpcMainEvent, campaigns: any[]) => {
    let promises: Promise<string>[] = [];
    for (let campaign of campaigns) {
        promises.push(Campaign.save(campaign.code, campaign.name, campaign.expire));
    }

    Promise.all(promises).then(() => {
        e.sender.send('show-message', '保存完了', 'success')
    }).catch((err) => {
        e.sender.send('show-message', err.toString(), 'danger', false)
    });
});

electron.ipcMain.on('send', (e: IpcMainEvent, codes: string[], target: string, env: string) => {
    e.sender.send('show-message', '送信中......', 'success', false);

    let promises: Promise<string>[] = [];
    for (let code of codes) {
        promises = promises.concat(
            Campaign.send(code, target, env)
        );
    }

    Promise.all(promises).then(() => {
        e.sender.send('show-message', '送信完了', 'success');
    }).catch((err) => {
        e.sender.send('show-message', err.toString(), 'danger', false);
    });
});

electron.ipcMain.on('csv', async (e: IpcMainEvent, codes: string[]) => {
    const result = await electron.dialog.showOpenDialog(
        win,
        {
            title: 'select directory',
            properties: ['openDirectory', 'createDirectory']
        }
    );

    if (!result.canceled) {
        const dir = result.filePaths[0];
        for (let code of codes) {
            let file = dir + '/' + code + '.csv';
            fs.writeFile(file, Campaign.makeCsv(code), (error) => {
                if (error != null) {
                    console.log(error);
                }
            })
        }
    }
});
