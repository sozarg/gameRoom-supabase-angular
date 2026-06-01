import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(Supabase);
  const router = inject(Router);

  const user = await supabaseService.getCurrentUser();

  if (user) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
