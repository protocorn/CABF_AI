'use client';

import React, { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function DocumentGenerator() {
  const [documents, setDocuments] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [query, setQuery] = useState<string>('');
  const [outputType, setOutputType] = useState<string>('pdf');
  const [numPages, setNumPages] = useState<number>(1);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, type: 'document' | 'image') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (type === 'document') {
      setDocuments((prev) => [...prev, ...files]);
    } else {
      setImages((prev) => [...prev, ...files]);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">AI Document Generator</h1>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Upload Context Documents</label>
            <Input type="file" multiple onChange={(e) => handleFileUpload(e, 'document')} />
          </div>

          <div>
            <label className="block font-medium mb-2">Select Output Format</label>
            <Select onValueChange={setOutputType} defaultValue={outputType}>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">DOCX</SelectItem>
              <SelectItem value="ppt">PowerPoint (PPT)</SelectItem>
              <SelectItem value="x">Twitter Post</SelectItem>
              <SelectItem value="instagram">Instagram Post</SelectItem>
            </Select>
          </div>

          <div>
            <label className="block font-medium mb-2">How many pages/slides?</label>
            <Input
              type="number"
              min={1}
              value={numPages}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNumPages(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Enter Query for Generation</label>
            <Textarea
              placeholder="What do you want to generate?"
              value={query}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Add Supporting Images (optional)</label>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'image')}
            />
          </div>

          <Button className="w-full">Generate Document</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">Preview Documents</TabsTrigger>
          <TabsTrigger value="images">Preview Images</TabsTrigger>
        </TabsList>
        <TabsContent value="docs">
          <ul className="space-y-2">
            {documents.map((file, index) => (
              <li key={index} className="text-sm text-gray-600">{file.name}</li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="images">
          <div className="grid grid-cols-3 gap-4">
            {images.map((file, index) => (
              <img
                key={index}
                src={URL.createObjectURL(file)}
                alt={`preview-${index}`}
                className="rounded shadow h-32 object-cover"
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
