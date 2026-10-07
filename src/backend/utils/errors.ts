export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { code: string; missingFields: string[] },
  ) {
    super(message);
  }
}
export function requireThat(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
