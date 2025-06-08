import { environment } from '../../environments/environment';

export class UriCostants {
  private static readonly proxyUrl: string = `${environment.apiUrl}`;

  public static readonly modelsUrl: string = `${this.proxyUrl}/api/file`;
}
