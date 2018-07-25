import { RouterModule, Routes } from "@angular/router";
import { ModuleWithProviders } from "@angular/core";
import { LogoutComponent } from "./logout/logout.component";
import { SearchComponent } from './search/search.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LogoutComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'search', component: SearchComponent },
];

export const routing: ModuleWithProviders = RouterModule.forRoot(routes);
