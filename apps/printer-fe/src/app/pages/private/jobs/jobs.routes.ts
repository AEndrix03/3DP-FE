import { Routes } from "@angular/router";
import { JobsComponent } from "./jobs.component";
import { ModelDetailComponent } from "./model-detail/model-detail.component";

export const routes: Routes = [
    {
        path: '',
        component: JobsComponent
    },
    {
        path: 'model-detail',
        component: ModelDetailComponent
    }
]