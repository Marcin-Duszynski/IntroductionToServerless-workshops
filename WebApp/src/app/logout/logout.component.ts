import { Component, OnInit } from "@angular/core";
import { LoginService } from "../shared/login.service";

declare var require: any;
const appConfig = require('./../appConfig.json');

@Component({
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css'],
})
export class LogoutComponent implements OnInit {
  public loginUri = appConfig.loginUrl;
  
  constructor(private loginService: LoginService) {
  }

  ngOnInit() {
    this.loginService.logout();
  }
}