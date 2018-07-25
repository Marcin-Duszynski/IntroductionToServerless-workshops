import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MatListModule, MatSidenavModule, MatCardModule, MatIconModule, MatToolbarModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatGridListModule, MatCheckboxModule } from '@angular/material';

import { FlexLayoutModule } from '@angular/flex-layout';
import { NgAisModule } from 'angular-instantsearch';

import { routing } from "./app.routes";
import { AppComponent } from './app.component';

import { LogoutComponent } from './logout/logout.component';
import { SearchComponent } from './search/search.component';

@NgModule({
  declarations: [
    AppComponent,
    LogoutComponent,
    SearchComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    MatGridListModule,
    MatCardModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FlexLayoutModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatListModule,
    NgAisModule.forRoot(),
    routing,
  ],
  providers: [],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
