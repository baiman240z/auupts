import fs from "fs";
import FtpClient from "ftp";
import JSZip from "jszip";
import iconv from "iconv-lite";
import DeleteFile from "del";
import {Util} from "./util";
import {Config} from "./config";

export class Campaign {
    private static _save(file: string, name: string, expire: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(file, {encoding: 'utf8'}, (err, data) => {
                if (err) {
                    throw err;
                }
                data = data.replace(/(CAMPAIGN_NAME(?:.|\s)+?)<value>.+<\/value>/im, '$1<value>' + name + '</value>');
                data = data.replace(/(EXPIRE(?:.|\s)+?)<value>[^<]+<\/value>/im, '$1<value>' + expire + ' 23:59:59</value>');
                data = data.replace(/\r\n/g, "\n");
                fs.writeFile(file, data, {encoding: 'utf8'}, (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(file);
                });
            });
        });
    }

    public static save(code: string, name: string, expire: string): Promise<string>[] {
        let dir = Util.basedir() + '/data';
        let promises: Promise<string>[] = [];

        promises.push(
            Campaign._save(`${dir}/adminpage/${code}/config.xml`, name, expire)
        );
        promises.push(
            Campaign._save(`${dir}/contents/${code}/config.xml`, name, expire)
        );

        return promises;
    }

    public static _send(ftp: FtpClient, localDir: string, remoteDir: string) {
        ftp.mkdir(remoteDir, (err: Error) => {
            if (err) {
                if (err.message != 'Create directory operation failed.') {
                    console.log(err.message);
                    throw err;
                }
            }
            fs.readdir(localDir, (err, files) => {
                if (err) {
                    throw err;
                }
                for (let k in files) {
                    let file = files[k];
                    let localFile = localDir + '/' + file;
                    let remoteFile = remoteDir + '/' + file;
                    let stat = fs.lstatSync(localFile);
                    if (stat.isDirectory()) {
                        Campaign._send(ftp, localFile, remoteFile);
                    } else {
                        ftp.put(localFile, remoteFile, (err: Error) => {
                            if (err) {
                                throw err;
                            }
                            console.log(localFile + ' -> ' + remoteFile);
                            ftp.end();
                        });
                    }
                }
            });
        });
    }

    static send(code: string, target: string, env: string): Promise<string>[] {
        const serverConfig = Config.get(`server-${env}`);
        const basedir = Util.basedir();
        const dirmap: any = {
            'consumer': 'p',
            'solution': 'z'
        };
        const imgdir = dirmap[target];
        const protocol = 'https';

        let promises: Promise<string>[] = [];

        promises.push(
            new Promise((resolve, reject) => {
                let ftp = new FtpClient();
                ftp.on('ready', () => {
                    try {
                        Campaign._send(
                            ftp,
                            `${basedir}/data/adminpage/${code}`,
                            `/camp86/adminpage/lib/${protocol}/${target}/etc/${code}`
                        );
                    } catch (err) {
                        reject(err);
                    }
                });

                ftp.on('error', (err) => {
                    reject(err);
                });

                ftp.on('close', (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve('adminpage');
                });

                ftp.connect({
                    host: serverConfig['host-adminpage'],
                    user: serverConfig.user,
                    password: serverConfig.password
                });
            })
        );

        promises.push(
            new Promise((resolve, reject) => {
                let ftp = new FtpClient();
                ftp.on('ready', () => {
                    try {
                        Campaign._send(
                            ftp,
                            `${basedir}/data/contents/${code}`,
                            `/camp86/contents/lib/https/${imgdir}/etc/${code}`
                        );
                        Campaign._send(
                            ftp,
                            `${basedir}/data/image/${code}`,
                            `/camp86/contents/htdocs/https/${imgdir}/${code}`
                        );
                    } catch (err) {
                        reject(err);
                    }
                });

                ftp.on('error', (err) => {
                    if (err) {
                        reject(err);
                    }
                    throw err
                });

                ftp.on('close', (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve('contents');
                });

                ftp.connect({
                    host: serverConfig['host-contents'],
                    user: serverConfig.user,
                    password: serverConfig.password
                })
            })
        );

        return promises;
    }

    private static mkDir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }

    public static unzip(file: string, callback: Function) {
        fs.readFile(file, 'binary', (err, data) => {
            if (err) {
                throw err;
            }

            JSZip.loadAsync(data, {
                base64: false,
                checkCRC32: false,
                optimizedBinaryString: true,
                decodeFileName: (bytes: any) => {
                    return iconv.decode(bytes, 'sjis');
                }
            }).then((zip: JSZip) => {
                let promises = [];

                const regContents = /テンプレートHTML\/(.+)$/;
                const regAdminpage = /(?:送信メールテキスト|テンプレートメール)\/(.+)$/;
                const regImage = /テンプレート画像\/(.+)$/;
                const regDir = /^(.+)\/.+$/;
                const dataDir = Util.basedir() + '/data/';

                DeleteFile.sync(dataDir + 'contents');
                this.mkDir(dataDir + 'contents');
                DeleteFile.sync(dataDir + 'adminpage');
                this.mkDir(dataDir + 'adminpage');
                DeleteFile.sync(dataDir + 'image');
                this.mkDir(dataDir + 'image');

                for (let name in zip.files) {
                    promises.push(new Promise((resolve) => {
                        let f = zip.files[name];
                        let newName: string | null = null;

                        let matched = regContents.exec(name);
                        if (matched) {
                            newName = 'contents/' + matched[1];
                        }

                        matched = regAdminpage.exec(name);
                        if (matched) {
                            newName = 'adminpage/' + matched[1];
                        }

                        matched = regImage.exec(name);
                        if (matched) {
                            newName = 'image/' + matched[1];
                        }

                        if (newName != null) {
                            matched = regDir.exec(newName);
                            if (matched) {
                                this.mkDir(dataDir + matched[1]);
                            }
                            f.async('uint8array').then((content) => {
                                const _savepath: string = dataDir + newName;
                                fs.writeFile(_savepath, content, {encoding: "utf8"}, (err) => {
                                    if (err) {
                                        console.log('error:' + err);
                                    }
                                    resolve(_savepath);
                                });
                            });
                        }
                    }));
                }

                Promise.all(promises).then(() => {
                    callback();
                });
            });
        });
    }

    public static makeCsv(code: string) {
        let text = '';
        for (let i = 1; i <= 2; i++) {
            text += '09099999999,' + code + '000' + i + ',couponx' + code + '000' + i + ',0,1' + "\n";
        }
        return text;
    }
}
