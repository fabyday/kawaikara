import * as fs from 'fs';
import * as path from 'path';

export function read_image_as_base64(pth : string){
    let fbuf = new Buffer("");
    try{
        //@ts-ignore
        fbuf = fs.readFileSync(pth)

    }catch{
        console.log('error read image')
    }
    return `data:image/png;base64,${fbuf.toString("base64")}`
}



function write_json(path: string) {}

export function read_json(pth: string) {
    let file_data = null;
    try {
        const stat = fs.statSync(pth);
        if (stat.isDirectory()) {
            return file_data;
        } else if (stat.isFile()) {
            if (path.extname(pth) === '.json') {
                file_data = fs.readFileSync(pth, { encoding: 'utf8' });
                file_data = JSON.parse(file_data);
            }
        }
    } catch (error) {
        console.log(error);
    }
    return file_data;
}

export function read_json_filenames_in_dir(
    dir_pth: string,
    is_abs_path: boolean = true,
) {
    let json_names: string[] = [];
    try {
        const stat = fs.statSync(dir_pth);
        if (stat.isDirectory()) {
            json_names = fs.readdirSync(dir_pth, {
                encoding: 'utf8',
            });
        }
    } catch (e) {
        console.log(e);
    }

    if (is_abs_path) {
        json_names = json_names.map((p) => {
            return path.resolve(path.join(dir_pth, p));
        });
    }

    return json_names;
}

export function read_json_from_candidates(...path_candidates: string[]) {}
