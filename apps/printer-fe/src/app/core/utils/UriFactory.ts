import { environment } from '../../environments/environment';

export class UriFactory {
  private static readonly apiUrl: string = environment.apiUrl;

  public static readonly driverApiUrl: string = `${UriFactory.apiUrl}/api/ssssdrivers`;
  public static readonly archiveApiUrl: string = `${UriFactory.apiUrl}/api/file`;
  public static readonly printerApiUrl: string = `${UriFactory.apiUrl}/api/printer`;
  public static readonly slicingApiUrl: string = `${UriFactory.apiUrl}/api/slicing`;
}
