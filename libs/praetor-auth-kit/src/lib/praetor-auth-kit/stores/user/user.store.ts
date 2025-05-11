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
  roles: Record<string, string> | null;
  activeRoleId: string | null;
};

const initialState: UserState = {
  user: null,
  roles: null,
  activeRoleId: null,
};

export const userStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, activeRoleId }) => ({
    isLoggedIn: computed(() => user != null),
    changeRole: computed(() => activeRoleId),
  })),
  withMethods((store) => ({
    restore: () => {
      if (typeof window === 'undefined') return;

      const rawUser = sessionStorage.getItem('3dprinter_user');
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser) as UserDto;
          patchState(store, { user });
        } catch {
          sessionStorage.removeItem('3dprinter_user');
        }
      }

      const rawRole = sessionStorage.getItem('3dprinter_active_role');
      if (rawRole) {
        try {
          const activeRoleId = JSON.parse(rawRole) as string;
          patchState(store, { activeRoleId });
        } catch {
          sessionStorage.removeItem('3dprinter_active_role');
        }
      }
    },

    setUser: (user: UserDto) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('3dprinter_user', JSON.stringify(user));
      }
      patchState(store, (state) => ({ ...state, user }));
    },

    setRoles: (roles: Record<string, string>) => {
      const activeRoleId = Object.values(roles)[0] ?? null;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          '3dprinter_active_role',
          JSON.stringify(activeRoleId)
        );
      }
      patchState(store, (state) => ({ ...state, roles, activeRoleId }));
    },

    setActiveRoleId: (activeRoleId: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          '3dprinter_active_role',
          JSON.stringify(activeRoleId)
        );
      }
      patchState(store, (state) => ({ ...state, activeRoleId }));
    },

    clear: () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('3dprinter_user');
        sessionStorage.removeItem('3dprinter_active_role');
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
