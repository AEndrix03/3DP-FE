import { environment } from '../../environments/environment';

export class UriCostants {
  private static readonly proxyUrl: string = `${environment.apiUrl}`;

  public static readonly filesUrl: string = `${this.proxyUrl}/api/file`;
  public static readonly modelsUrl: string = `${this.proxyUrl}/api/model`;
  public static readonly printerUrl: string = `${this.proxyUrl}/api/printer`;
  public static readonly jobUrl: string = `${this.proxyUrl}/api/job`;

  public static readonly slicingUrl: string = `${this.proxyUrl}/api/slicing`;
  public static readonly slicingPropertyUrl: string = `${this.proxyUrl}/api/slicing/property`;
  public static readonly slicingQueueUrl: string = `${this.proxyUrl}/api/slicing/queue`;

  public static readonly materialUrl: string = `${this.proxyUrl}/api/material`;
}
