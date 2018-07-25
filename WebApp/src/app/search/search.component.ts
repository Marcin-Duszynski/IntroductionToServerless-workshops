import { Component, OnInit } from "@angular/core";
import { ObservableMedia } from '@angular/flex-layout';
import { Observable, Subject } from 'rxjs';
import { map, startWith, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SearchResult } from '../shared/model/searchResult';
import { SearchService } from "../shared/search.service";

@Component({
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit {
  events: string[] = [];
  opened: boolean;
  cols: Observable<number>;
  results = new SearchResult();

  private searchQuery = new Subject<string>();
  
  constructor(private observableMedia: ObservableMedia, private searchService: SearchService) { }

  ngOnInit() {
    this.makeGridSizeDynamic();

    this.searchQuery.pipe(
      debounceTime(100),
      distinctUntilChanged(),
      switchMap((query: string) => this.searchService.search(query)),
    ).subscribe((results) => {
      this.results = results;
    });
  }

  public search(query: string): void {
    console.log(query);
    this.searchQuery.next(query);
  }

  private makeGridSizeDynamic(): any {
    const grid = new Map([
      ['xs', 1],
      ['sm', 2],
      ['md', 4],
      ['lg', 5],
      ['xl', 7]
    ]);

    let start: number;

    grid.forEach((cols, mqAlias) => {
      if (this.observableMedia.isActive(mqAlias)) {
        start = cols;
      }
    });

    this.cols = this.observableMedia.asObservable().pipe(
      map(change => {
        return grid.get(change.mqAlias);
      }),
      startWith(start),
    );
  }
}