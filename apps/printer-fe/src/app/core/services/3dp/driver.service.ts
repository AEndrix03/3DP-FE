import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UriFactory } from '../../utils/UriFactory';
import { DriverDto, DriverCreateDto, DriverSaveDto } from '../../models/driver.models';

@Injectable({
  providedIn: 'root'
})
export class DriverService {
  private readonly url = UriFactory.driverApiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * Get a driver by its ID
   * @param id The UUID of the driver
   * @returns An Observable of DriverDto
   */
  getDriverById(id: string): Observable<DriverDto> {
    return this.http.get<DriverDto>(`${this.url}/${id}`);
  }

  /**
   * Get all drivers
   * @returns An Observable of an array of DriverDto
   */
  getAllDrivers(): Observable<DriverDto[]> {
    return this.http.get<DriverDto[]>(this.url);
  }

  /**
   * Create a new driver
   * @param driverCreateDto The driver creation data
   * @returns An Observable containing the UUID of the created driver
   */
  createDriver(driverCreateDto: DriverCreateDto): Observable<string> {
    return this.http.post<string>(this.url, driverCreateDto);
  }

  /**
   * Update an existing driver
   * @param driverSaveDto The driver update data
   * @returns An Observable containing the UUID of the updated driver
   */
  updateDriver(driverSaveDto: DriverSaveDto): Observable<string> {
    return this.http.put<string>(this.url, driverSaveDto);
  }

  /**
   * Delete a driver by its ID
   * @param id The UUID of the driver to delete
   * @returns An Observable of void
   */
  deleteDriver(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
