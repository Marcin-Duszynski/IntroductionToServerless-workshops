import { Injectable } from '@angular/core';

const localStorageLoggedInFieldName = 'loggedIn';
const localStorageTokenFieldName = 'token';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private loggedInStatus = JSON.parse(localStorage.getItem(localStorageLoggedInFieldName) || 'false')

  public logout(): boolean {
    this.loggedInStatus = false;
    localStorage.setItem(localStorageLoggedInFieldName, 'false');
    localStorage.removeItem(localStorageTokenFieldName);

    return true;
  }

  public isLoggedIn(uriFragment: string): boolean {

    if (uriFragment) {
      uriFragment.split('&').forEach(param => {
        if (param.startsWith('id_token')) {
          this.loggedInStatus = true;
          localStorage.setItem(localStorageLoggedInFieldName, 'true');
          localStorage.setItem(localStorageTokenFieldName, param.slice(param.indexOf('=') + 1));
        }
      });
    }

    return this.loggedInStatus;
  }
}
