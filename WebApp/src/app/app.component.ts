import { Component } from '@angular/core';

declare var require: any;
const appConfig = require('./appConfig.json');

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  public loginUri = appConfig.loginUrl;
}