import fs from "fs";
import YAML from "yaml";
import {Util} from "./util";

export class Config {
    public static get(name: string, file: string = 'application'): any {
        try {
            const config = YAML.parse(
                fs.readFileSync(
                    `${Util.basedir()}/config/${file}.yaml`,
                    {encoding: 'utf8'}
                )
            );
            if (config[name] == undefined) {
                return null
            }
            return config[name]
        } catch (err) {
            console.log(err);
            return null
        }
    }
}
