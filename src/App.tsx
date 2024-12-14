import React, { useEffect, useState } from 'react';
import { DeskThing, SocketData } from 'deskthing-client';

const App: React.FC = () => {
    const deskthing = DeskThing.getInstance();
    const [imageData, setImageData] = useState<string | null>(null);

    useEffect(() => {
        const onAppData = async (data: SocketData) => {
            if (data.type === 'imageData') {
                if (data.payload) {
                    setImageData(data.payload as string);
                }
            }
        };

        // Listen for the 'imageData' event
        deskthing.on('imageData', onAppData);

        // Request the image when the component mounts
        deskthing.send({ type: 'get', request: 'image' });

        // Cleanup function to remove the event listener
        return () => {
            deskthing.off('imageData', onAppData);
        };
    }, [deskthing]); // Add deskthing to the dependency array

    const handleRequestImage = async () => {
        deskthing.send({ type: 'get', request: 'image' });
    };

    return (
        <div className="bg-slate-800 w-screen h-screen flex justify-center items-center">
            {imageData ? (
                <img src={imageData} alt="Received from server" className="w-full h-full" />
            ) : (
                <div>
                    <p className="font-bold text-5xl text-white">Google Photos</p>
                    <button onClick={handleRequestImage}>Request Image</button>
                </div>
            )}
        </div>
    );
};

export default App;