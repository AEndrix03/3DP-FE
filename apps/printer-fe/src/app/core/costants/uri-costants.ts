import { environment } from '../../environments/environment';

export class UriCostants {
  private static readonly proxyUrl: string = `${environment.apiUrl}`;

  public static readonly filesUrl: string = `${this.proxyUrl}/api/file`;
  public static readonly modelsUrl: string = `${this.proxyUrl}/api/model`;
  public static readonly slicingUrl: string = `${this.proxyUrl}/api/slicing`;
  public static readonly slicingPropertyUrl: string = `${this.proxyUrl}/api/slicing/property`;
}
