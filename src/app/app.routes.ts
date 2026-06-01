import { Routes } from '@angular/router';
import { Home} from './pages/home/home';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { AboutMe } from './pages/about-me/about-me';
import { Error } from './pages/error/error';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'about-me', component: AboutMe },

  {
    path: 'resultados',
    loadComponent: () => import('./pages/resultados/resultados').then(m => m.Resultados)
  },
  
  // lazy loading de juegos: carga rutas hijas bajo demanda con loadChildren
  { 
    path: 'juegos', 
    // guard: exige sesion iniciada antes de entrar
    canActivate: [authGuard],
    loadChildren: () => import('./modules/games/games.routes').then(m => m.JUEGOS_ROUTES) 
  },
  
  { path: '**', component: Error }
];
