import electron, {IpcRendererEvent} from "electron";
import {Util} from "./classes/util";
import fs from "fs";
import {Config} from "./classes/config";
import $ from "jquery";

window.onload = () => {

    $.datepicker.regional["ja"] = {
        clearText: "クリア", clearStatus: "日付をクリアします",
        closeText: "閉じる", closeStatus: "変更せずに閉じます",
        prevText: "&#x3c;前", prevStatus: "前月を表示します",
        prevBigText: "&#x3c;&#x3c;", prevBigStatus: "前年を表示します",
        nextText: "次&#x3e;", nextStatus: "翌月を表示します",
        nextBigText: "&#x3e;&#x3e;", nextBigStatus: "翌年を表示します",
        currentText: "今日", currentStatus: "今月を表示します",
        monthNames: [
            "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"
        ],
        monthNamesShort: [
            "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"
        ],
        monthStatus: "表示する月を変更します", yearStatus: "表示する年を変更します",
        weekHeader: "週", weekStatus: "暦週で第何週目かを表します",
        dayNames: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
        dayNamesShort: ["日", "月", "火", "水", "木", "金", "土"],
        dayNamesMin: ["日", "月", "火", "水", "木", "金", "土"],
        dayStatus: "週の始まりをDDにします", dateStatus: "Md日(D)",
        dateFormat: "yy-mm-dd", firstDay: 0,
        initStatus: "日付を選択します", isRTL: false,
        showMonthAfterYear: true
    };
    $.datepicker.setDefaults($.datepicker.regional["ja"]);

    $('#wait button.close').on('click', () => {
        $('#wait').hide();
    });

    Util.setDroppable('body', (file: any) => {
        electron.ipcRenderer.send('unzip', file.path);
    });

    const addForm = (code: string) => {
        const clone = $('#hidden-box .campaign').clone(true);
        clone.find('[name=code]').text(code);
        $('#campaign-form').append(clone);

        clone.find('input[name=expire]').datepicker();

        const xml = fs.readFileSync(
            `${__dirname}/../data/adminpage/${code}/config.xml`,
            {encoding: 'utf8'}
        );
        let matched = xml.match(/CAMPAIGN_NAME(?:.|\s)+?<value>(.+)<\/value>/im);
        if (matched) {
            clone.find('[name=name]').val(matched[1]);
        }

        matched = xml.match(/EXPIRE(?:.|\s)+<value>([0-9-]{10})[^<]*<\/value>/im);
        if (matched) {
            clone.find('[name=expire]').val(matched[1]);
        }
    };

    const findCampaign = (dir: string, deep: number) => {
        if (deep > 1) {
            return
        }

        const config = Config.get('dir-map');

        fs.readdir(dir, (err, files: string[]) => {
            for (let file of files) {
                for (let jpname in config) {
                    if (file == jpname && config.hasOwnProperty(jpname)) {
                        fs.renameSync(`${dir}/${file}`, `${dir}/${config[jpname]}`);
                        file = config[jpname];
                    }
                }

                let path = `${dir}/${file}`;
                let stat = fs.lstatSync(path);
                if (stat.isDirectory()) {
                    let matched = path.match(/adminpage\/([a-z0-9]{4})/i);
                    if (matched) {
                        addForm(matched[1]);
                    }
                    findCampaign(path, deep + 1);
                }
            }
        })
    };

    findCampaign(Util.basedir() + '/data', 0);

    $('button[name=clear-btn]').on('click', () => {
        electron.ipcRenderer.send('clear');
    });

    $('button[name=save-btn]').on('click', () => {
        let campaigns: any[] = [];
        $('#campaign-form div.campaign').each((index, element) => {
            const target = $(element);
            campaigns.push({
                code: target.find('[name=code]').text(),
                name: target.find('input[name=name]').val(),
                expire: target.find('input[name=expire]').val()
            });
        });

        electron.ipcRenderer.send('save', campaigns);
    });

    $('button[name=csv-btn]').on('click', () => {
        let codes: string[] = [];
        $('#campaign-form div.campaign').each((index, element) => {
            const target = $(element);
            codes.push(target.find('[name=code]').text());
        });
        electron.ipcRenderer.send('csv', codes);
    });

    $('button[name=send-btn]').on('click', () => {
        let codes: string[] = [];
        $('#campaign-form div.campaign').each((index, element) => {
            const target = $(element);
            codes.push(target.find('[name=code]').text());
        });
        electron.ipcRenderer.send(
            'send',
            codes,
            $('input[name=target]:checked').val(),
            $('input[name=env]:checked').val()
        );
    });

    electron.ipcRenderer.on('log', (e: IpcRendererEvent, text: string) => {
        console.log(text);
    });

    electron.ipcRenderer.on('show-message', (e: IpcRendererEvent, message: string, style: string, isFade: boolean = true) => {
        Util.showMessage(message, style, isFade);
    });

    electron.ipcRenderer.on('find-campaign', () => {
        $('#campaign-form').empty();
        findCampaign(Util.basedir() + '/data', 0);
    });
};
