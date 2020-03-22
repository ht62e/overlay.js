export class Result {
    isOk: boolean;
    data?: any;

    constructor(isOk: boolean, data?: any) {
        this.isOk = isOk;
        this.data = data;
    }

    public static ok(data?: any): Result {
        return new Result(true, data);
    }

    public static cancel(data?: any): Result {
        return new Result(false, data);
    }
}
