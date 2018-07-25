import { ActivatedRoute } from '@angular/router';
import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SearchResult } from './model/searchResult';

declare var require: any;
const appConfig = require('./../appConfig.json');
const searchUrl = appConfig.searchUrl;

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  public search (query: string): Observable<SearchResult> {
    console.log("Search started");

    if (!query.trim()) {
      return of(new SearchResult());
    }

    return this.http.get<SearchResult>(`${searchUrl}/${query}`).pipe(
      tap(items => console.debug(items)),
      catchError(this.handleError<SearchResult>('search', new SearchResult()))
    )
  }

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => { 
      console.error(error);

      return of(result as T);
    };
  }
}