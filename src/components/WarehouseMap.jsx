import React, { useState, useEffect } from 'react';
import { Box, Layers, Map, Flame } from 'lucide-react';
import { API_URL } from '../services/apiClient';

const WarehouseMap = ({ inventory, onSelectInfo }) => {
    const [hotItems, setHotItems] = useState([]);
    const [viewMode, setViewMode] = useState('2D'); // 2D or List

    useEffect(() => {
        // Fetch predictive analytics
        fetch(`${API_URL}/inventory/analytics`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                // data is array of { location: "Box A-1", frequency: 5, ... }
                // We need to map this to inventory IDs if possible, or just box names
                setHotItems(data);
            })
            .catch(err => console.error("Analytics Error:", err));
    }, []);

    // Group inventory by Rack
    const racks = {}; // { 'A': [items...], 'B': ... }
    inventory.forEach(item => {
        const r = item.rack || 'Unsorted';
        if (!racks[r]) racks[r] = [];
        racks[r].push(item);
    });

    const isHot = (item) => {
        // Check if item is in hotItems list (by box ID comparison)
        if (!item.boxData || !item.boxData.box_id) return false;
        return hotItems.some(h => {
            // Heuristic matching: analytics details might differ from box_id format
            return h.location && h.location.includes(item.boxData.box_id);
        });
    };

    // Configuration for Racks
    const rackConfig = {
        '1': { rows: 5, cols: 6 },
        '2': { rows: 5, cols: 6 },
        '3': { rows: 5, cols: 8 },
    };

    const getRackStyle = (rackName) => {
        const config = rackConfig[rackName] || { rows: 5, cols: 6 }; // Default 5x6
        return {
            gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
            display: 'grid',
            gap: '0.5rem'
        };
    };

    return (
        <div className="bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/40 shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Map className="w-6 h-6 text-blue-600" />
                    Denah Gudang Interaktif
                </h3>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mr-4">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div> Kosong</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div> Isi</span>
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> Popular</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {Array.from(new Set([...Object.keys(rackConfig), ...Object.keys(racks)])).sort().map(rackName => {
                    const config = rackConfig[rackName] || { rows: 5, cols: 6 };
                    const capacity = config.rows * config.cols;
                    const items = racks[rackName] || [];

                    // Generate slots for the grid
                    const slots = Array.from({ length: capacity }, (_, i) => {
                        // Try to find item at this specific index if available, or just map sequentially
                        const item = items[i];
                        return {
                            index: i,
                            item: item || null,
                            active: !!item && item.status !== 'EMPTY',
                            id: item ? item.id : `empty-${rackName}-${i}`
                        };
                    });

                    return (
                        <div key={rackName} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                            <h4 className="text-lg font-bold text-gray-700 mb-3 text-center border-b pb-2">
                                Rak {rackName} <span className="text-xs font-normal text-gray-500">({config.rows} Tingkat x {config.cols} Kolom)</span>
                            </h4>
                            <div style={getRackStyle(rackName)}>
                                {slots.map(slot => {
                                    const { item, active, index } = slot;
                                    const hot = item ? isHot(item) : false;

                                    return (
                                        <div
                                            key={slot.id}
                                            onClick={() => item && onSelectInfo(item)}
                                            className={`
                                                aspect-square rounded-lg border flex flex-col items-center justify-center p-1 relative
                                                ${item ? 'cursor-pointer transition-all hover:scale-105' : 'cursor-default'}
                                                ${active
                                                    ? (hot ? 'bg-orange-50 border-orange-200 shadow-orange-100' : 'bg-blue-50 border-blue-200 shadow-blue-100')
                                                    : 'bg-green-50 border-green-200'}
                                            `}
                                        >
                                            <span className="text-[10px] font-bold text-gray-400 absolute top-0.5 left-1 opacity-50">
                                                {index + 1}
                                            </span>

                                            {
                                                active ? (
                                                    <>
                                                        <Box className={`w-4 h-4 ${hot ? 'text-orange-500' : 'text-blue-500'} mb-1`} />
                                                        <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center leading-none">
                                                            {item.boxData?.box_id || item.id}
                                                        </span>
                                                        {hot && (
                                                            <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5 animate-pulse">
                                                                <Flame className="w-2 h-2 text-white" />
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-green-200/50"></div>
                                                )
                                            }
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WarehouseMap;
