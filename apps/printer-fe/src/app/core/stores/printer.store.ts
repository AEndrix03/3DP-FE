import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PrinterDto } from '../models/printer.models';

type PrinterState = {
  entities: PrinterDto[];
};

const initialState: PrinterState = {
  entities: [],
};

export const printerStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setAll: (entities: PrinterDto[]) => {
      patchState(store, (state) => ({ ...state, entities }));
    },
  }))
);
