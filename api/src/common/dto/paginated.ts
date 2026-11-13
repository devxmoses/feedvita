export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    pageCount: number;
}

export interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}

export function paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
): Paginated<T> {
    return {
        data,
        meta: { total, page, limit, pageCount: Math.ceil(total / limit) },
    };
}
