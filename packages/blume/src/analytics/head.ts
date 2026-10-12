/** A consent provider bootstrap tag. Analytics scripts are managed by c15t. */
export interface HeadScript {
  attributes: Record<string, string | boolean>;
  content: string | null;
}
