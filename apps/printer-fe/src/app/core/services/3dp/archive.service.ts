import { Injectable } from '@angular/core';
import { UriFactory } from '../../utils/UriFactory';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FileUploadResponseDto } from '../../models/archive.models';

@Injectable({
  providedIn: 'root',
})
export class ArchiveService {
  private readonly url = UriFactory.archiveApiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * Uploads a file to the server
   * @param file The file to upload
   * @returns An Observable of FileUploadResponseDto containing the uploaded file information
   */
  uploadFile(file: File): Observable<FileUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FileUploadResponseDto>(`${this.url}/upload`, formData);
  }

  /**
   * Downloads a file from the server by its ID
   * @param id The UUID of the file to download
   * @returns An Observable of Blob containing the file content
   */
  downloadFile(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Gets a list of all files stored on the server
   * @returns An Observable of an array of FileUploadResponseDto
   */
  getAllFiles(): Observable<FileUploadResponseDto[]> {
    return this.http.get<FileUploadResponseDto[]>(`${this.url}`);
  }
}
