export interface IResponse {
    message?: boolean | string;
    data?: unknown;
    extra?: unknown;
    status?: number;
}
