'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Edit3Icon, Trash2 } from 'lucide-react';

import { deleteFile } from '@/app/actions/ftp/deleteFile';
import { downloadFile } from '@/app/actions/ftp/downloadFile';
import { GetFiles } from '@/app/actions/ftp/getFiles';
import { renameFile } from '@/app/actions/ftp/renameFile';
import { UploadFile } from '@/app/actions/ftp/uploadFile';
import { ReactTable } from '@/components/ReactTable';
import { Card, Spinner, useToast } from '@sanity/ui';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FTPComponent() {
  const [data, setData] = useState<unknown[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [updatedFilename, setUpdatedFilename] = useState('');
  const [loc, setLoc] = useState<'images' | 'docs'>('images');
  const [editingFilename, setEditingFilename] = useState<string | null>(null); // Track which file is being edited

  const toast = useToast();

  // Fetch files on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await GetFiles(loc);
        setData(result);
      } catch (err) {
        console.error(`FTP Error: ${err}`);
        toast.push({
          status: 'error',
          title: "Can't connect to FTP server",
          description: 'Check logs',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast, loc]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent the default form submission
    setIsUploading(true);

    const formData = new FormData(event.currentTarget); // Get form data
    const file = formData.get('file') as File;

    if (!file?.name) {
      toast.push({
        status: 'info',
        title: 'Error Uploading to FTP server',
        description: 'Please attach a file',
      });
      setIsUploading(false);
      return;
    }

    try {
      await UploadFile({ formData, loc });
      toast.push({
        status: 'success',
        title: 'File uploaded successfully.',
      });
      // Refresh the file list after upload
      const result = await GetFiles(loc);
      setData(result);
    } catch (err: unknown) {
      toast.push({
        status: 'error',
        title: 'Error Uploading to FTP server',
        description: err as string,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = useCallback(
    async (filename: string) => {
      try {
        const stream = await downloadFile({ filename, loc });

        const response = new Response(stream);
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.push({
          status: 'success',
          title: `File ${filename} downloaded successfully.`,
        });
      } catch (e) {
        const errorMsg = (e as { message: string })?.message || '';
        toast.push({
          status: 'error',
          title: 'Failed to download file',
          description: errorMsg,
        });
      }
    },
    [toast, loc]
  );

  const handleDelete = useCallback(
    async (filename: string) => {
      try {
        await deleteFile({ filename, loc });
        toast.push({
          status: 'success',
          title: `File ${filename} deleted successfully.`,
        });
        const result = await GetFiles(loc);
        setData(result);
      } catch (e) {
        const errorMsg = (e as { message: string })?.message || '';
        toast.push({
          status: 'error',
          title: 'Failed to delete file',
          description: errorMsg,
        });
      }
    },
    [loc, toast]
  );

  const handleRename = useCallback(
    async (oldFilename: string) => {
      if (updatedFilename === oldFilename) {
        console.log('return');
        setEditingFilename(null); // Reset editing state
        setUpdatedFilename(''); // Clear the input field
        return;
      }
      if (!updatedFilename) {
        toast.push({
          status: 'error',
          title: 'Error',
          description: 'Please enter a new filename.',
        });
        return;
      }

      try {
        await renameFile({ oldFilename, newFilename: updatedFilename, loc });
        toast.push({
          status: 'success',
          title: `File ${oldFilename} renamed to ${updatedFilename} successfully.`,
        });
        const result = await GetFiles(loc);
        setData(result);
        setEditingFilename(null); // Reset editing state
        setUpdatedFilename(''); // Clear the input field
      } catch (e) {
        const errorMsg = (e as { message: string })?.message || '';
        toast.push({
          status: 'error',
          title: 'Failed to rename file',
          description: errorMsg,
        });
      }
    },
    [loc, toast, updatedFilename]
  );

  const columns = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: ({ row }: any) => (
          <div className="flex items-center gap-2">
            {editingFilename === row.original.name ? (
              <Input
                key={row.original.name}
                value={updatedFilename}
                onChange={(e) => setUpdatedFilename(e.target.value)}
                className="w-auto"
                autoFocus
              />
            ) : (
              row.original.name
            )}
          </div>
        ),
      },
      {
        header: 'Size',
        accessorKey: 'size',
      },
      {
        header: 'Modified At',
        accessorKey: 'modifiedAt',
        meta: {
          className: 'text-right',
        },
      },
      {
        header: 'Actions',
        accessorKey: 'actions',
        enableSorting: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: ({ row }: any) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(row.original.name)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Download className="size-5" />
            </button>
            <button
              onClick={() => {
                setEditingFilename(row.original.name); // Enable editing mode
                setUpdatedFilename(row.original.name); // Pre-fill the input with the current filename
              }}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Edit3Icon className="size-5" />
            </button>
            <button
              onClick={() => handleDelete(row.original.name)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <Trash2 className="size-5" />
            </button>
            {editingFilename === row.original.name && (
              <Button
                onClick={() => handleRename(row.original.name)}
                size="sm"
                variant="outline"
              >
                Save
              </Button>
            )}
          </div>
        ),
      },
    ],
    [
      handleDownload,
      handleDelete,
      handleRename,
      editingFilename,
      updatedFilename,
    ]
  );

  return (
    <Card className="!rounded-lg">
      <CardHeader>
        <CardTitle className="flex justify-between gap-2 flex-wrap">
          <span>Files</span>
          <Select
            value={loc}
            onValueChange={(value: string) =>
              setLoc(value as 'images' | 'docs')
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent className="z-[1000]">
              <SelectItem value="images">Images</SelectItem>
              <SelectItem value="docs">Documents</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
        <form onSubmit={handleUpload} className="max-w-full flex gap-4 py-2">
          <Input name="file" type="file" />
          <Input name="loc" className="hidden" value={loc} readOnly />
          <Button
            type="submit"
            disabled={isUploading}
            className="flex items-center gap-2 min-w-20"
          >
            {isUploading ? (
              <Spinner muted className="!size-5" />
            ) : (
              <span>Upload</span>
            )}
          </Button>
        </form>
      </CardHeader>
      {isLoading ? (
        <CardContent className="flex items-center justify-center gap-2 pb-6 w-full">
          <Spinner muted />
        </CardContent>
      ) : (
        <ReactTable data={data} columns={columns} />
      )}
    </Card>
  );
}
