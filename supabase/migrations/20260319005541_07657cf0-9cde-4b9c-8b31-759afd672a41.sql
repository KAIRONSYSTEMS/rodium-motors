
-- Create cars table
CREATE TABLE public.cars (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    versao TEXT,
    ano_fabricacao INT NOT NULL,
    ano_modelo INT NOT NULL,
    quilometragem INT NOT NULL DEFAULT 0,
    cor TEXT,
    blindado BOOLEAN NOT NULL DEFAULT false,
    descricao TEXT,
    imagens TEXT[] DEFAULT '{}',
    preco NUMERIC,
    destaque BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Cars are viewable by everyone"
ON public.cars FOR SELECT
TO anon, authenticated
USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert cars"
ON public.cars FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "Authenticated users can update cars"
ON public.cars FOR UPDATE
TO authenticated
USING (true);

-- Authenticated users can delete
CREATE POLICY "Authenticated users can delete cars"
ON public.cars FOR DELETE
TO authenticated
USING (true);

-- Storage bucket for car images
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true);

CREATE POLICY "Car images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

CREATE POLICY "Authenticated users can upload car images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'car-images');

CREATE POLICY "Authenticated users can delete car images"
ON storage.objects FOR DELETE
USING (bucket_id = 'car-images');
