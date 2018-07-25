import { LoginService } from '../login.service';
import { Injectable } from "@angular/core";
import { CanActivate, ActivatedRouteSnapshot, Router } from "@angular/router";

@Injectable({
  providedIn: 'root',
})
export class CanActivateLogged implements CanActivate {
  constructor(private loginService: LoginService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const isUserLoggedIn = this.loginService.isLoggedIn(route.fragment);
    
    if (!isUserLoggedIn) {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }
}