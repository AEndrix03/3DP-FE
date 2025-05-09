import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { UserDto } from '../../models/user.models';

type UserState = {
  user: UserDto | null;
};

const initialState: UserState = {
  user: null,
};

export const userStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({
    isLoggedIn: computed(() => user != null),
  })),
  withMethods((store) => ({
    restore: () => {
      if (typeof window === 'undefined') return;

      const raw = sessionStorage.getItem('3dprinter_user');
      if (raw) {
        try {
          const user = JSON.parse(raw) as UserDto;
          patchState(store, { user });
        } catch {
          sessionStorage.removeItem('3dprinter_user');
        }
      }
    },

    setUser: (user: UserDto) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('3dprinter_user', JSON.stringify(user));
      }
      patchState(store, { user });
    },

    clear: () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('3dprinter_user');
      }
      patchState(store, initialState);
    },
  })),
  withHooks((store) => ({
    onInit() {
      store.restore();
    },
  }))
);
