import type { Serialized } from '@/backend/types/serialization';
// The same JSON conversion as Response.json, with a type-checked wire representation.
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value)) as Serialized<T>;
}
