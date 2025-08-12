import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UriCostants } from '../core/costants/uri-costants';
import {
  PrinterCreateDto,
  PrinterDetailDto,
  PrinterDetailSaveDto,
  PrinterDto,
  PrinterFilterDto,
  PrinterSaveDto,
} from '../core/models/printer.models';

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
  constructor(private readonly http: HttpClient) {}

  public getAllPrinters(): Observable<PrinterDto[]> {
    return this.http.get<PrinterDto[]>(UriCostants.printerUrl);
  }

  public getPrinterById(id: string): Observable<PrinterDto> {
    return this.http.get<PrinterDto>(`${UriCostants.printerUrl}/${id}`);
  }

  public createPrinter(printer: PrinterCreateDto): Observable<string> {
    return this.http.post<string>(UriCostants.printerUrl, printer);
  }

  public updatePrinter(printer: PrinterSaveDto): Observable<string> {
    return this.http.put<string>(UriCostants.printerUrl, printer);
  }

  public deletePrinter(id: string): Observable<void> {
    return this.http.delete<void>(`${UriCostants.printerUrl}/${id}`);
  }

  public getPrinterDetail(printerId: string): Observable<PrinterDetailDto> {
    return this.http.get<PrinterDetailDto>(
      `${UriCostants.printerUrl}/detail/${printerId}`
    );
  }

  public savePrinterDetail(
    printerDetail: PrinterDetailSaveDto
  ): Observable<string> {
    return this.http.patch<string>(
      `${UriCostants.printerUrl}/detail/${printerDetail.id}`,
      printerDetail
    );
  }

  /**
   * Search printers with filters - following materials pattern
   */
  public searchPrinters(filters: PrinterFilterDto): Observable<PrinterDto[]> {
    const params = new URLSearchParams();

    if (filters.name) params.append('name', filters.name);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.status) params.append('status', filters.status);

    const queryString = params.toString();
    const url = queryString
      ? `${UriCostants.printerUrl}/search?${queryString}`
      : `${UriCostants.printerUrl}`;

    return this.http.get<PrinterDto[]>(url);
  }

  /**
   * Get printers by status
   */
  public getPrintersByStatus(status: string): Observable<PrinterDto[]> {
    return this.http.get<PrinterDto[]>(
      `${UriCostants.printerUrl}/status/${status}`
    );
  }

  /**
   * Get printers by driver ID
   */
  public getPrintersByDriverId(driverId: string): Observable<PrinterDto[]> {
    return this.http.get<PrinterDto[]>(
      `${UriCostants.printerUrl}/driver/${driverId}`
    );
  }

  public connectDriverToPrinter(
    printerId: string,
    driverId: string
  ): Observable<string> {
    return this.http.patch<string>(
      `${UriCostants.printerUrl}/${printerId}/driver/${driverId}`,
      {}
    );
  }

  public disconnectDriverFromPrinter(printerId: string): Observable<string> {
    return this.http.patch<string>(
      `${UriCostants.printerUrl}/${printerId}/driver`,
      {}
    );
  }
}
