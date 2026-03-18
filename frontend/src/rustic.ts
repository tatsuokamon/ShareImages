export type Ok<T> = {
	type: "ok",
	data: T
}

export type Err<T> = {
	type: "err",
	data: T
}

export type Result<T, E> = Ok<T> | Err<E>;

