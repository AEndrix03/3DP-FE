import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UriFactory } from '../../utils/UriFactory';
import {
  PrinterCreateDto,
  PrinterDto,
  PrinterSaveDto,
} from '../../models/printer.models';

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
  private readonly url = UriFactory.printerApiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * Get a printer by its ID
   * @param id The UUID of the printer
   * @returns An Observable of PrinterDto
   */
  getPrinterById(id: string): Observable<PrinterDto> {
    return this.http.get<PrinterDto>(`${this.url}/${id}`);
  }

  /**
   * Get all printers
   * @returns An Observable of an array of PrinterDto
   */
  getAllPrinters(): Observable<PrinterDto[]> {
    return this.http.get<PrinterDto[]>(this.url);
  }

  /**
   * Create a new printer
   * @param printerCreateDto The printer creation data
   * @returns An Observable containing the UUID of the created printer
   */
  createPrinter(printerCreateDto: PrinterCreateDto): Observable<string> {
    return this.http.post<string>(this.url, printerCreateDto);
  }

  /**
   * Update an existing printer
   * @param printerSaveDto The printer update data
   * @returns An Observable containing the UUID of the updated printer
   */
  updatePrinter(printerSaveDto: PrinterSaveDto): Observable<string> {
    return this.http.put<string>(this.url, printerSaveDto);
  }

  /**
   * Delete a printer by its ID
   * @param id The UUID of the printer to delete
   * @returns An Observable of void
   */
  deletePrinter(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Connect a driver to a printer
   * @param printerId The UUID of the printer
   * @param driverId The UUID of the driver to connect
   * @returns An Observable containing the UUID of the updated printer
   */
  connectDriverToPrinter(
    printerId: string,
    driverId: string
  ): Observable<string> {
    return this.http.patch<string>(
      `${this.url}/${printerId}/driver/${driverId}`,
      {}
    );
  }

  /**
   * Disconnect a driver from a printer
   * @param printerId The UUID of the printer
   * @returns An Observable containing the UUID of the updated printer
   */
  disconnectDriverFromPrinter(printerId: string): Observable<string> {
    return this.http.patch<string>(`${this.url}/${printerId}/driver`, {});
  }
}
