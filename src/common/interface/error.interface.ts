export interface Ierror extends Error {
    status?: number;
    statusCode?: number;
}
