export class SearchResult {
  constructor(public query: string = '', public nbHits: number = 0, public hits: any[] = []) {}
}