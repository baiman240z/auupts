export class Util {
    public static setDroppable(selector: string, method: Function) {
        const dropArea = $(selector);
        dropArea.on('dragover dragenter', () => {
            return false
        });

        dropArea.on('drop', (e: any) => {
            const file = e.originalEvent.dataTransfer.files[0];
            method(file);
            return false;
        });
    }

    public static basedir() {
        return __dirname + '/../..';
    }

    public static showMessage(text: string, style: string, isFade = true) {
        $('#wait .message').text(text);
        const wait = $('#wait');
        wait.removeClass().addClass(style).show();
        if (isFade) {
            wait.stop().fadeOut(2000);
        }
    }
}
