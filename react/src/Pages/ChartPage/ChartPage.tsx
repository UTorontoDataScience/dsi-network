import React, { useEffect, useState } from 'react';
import getModel, {
    Campus,
    HydratedLink,
    hydrateLinks,
    Model,
} from './../../data/model';
import { ForceGraph, PackChart } from './../../Visualizations';

const ChartPage: React.FC<{}> = () => {
    const [links, setLinks] = useState<HydratedLink[]>();
    const [model, setModel] = useState<Model>();

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setLinks(hydrateLinks(model));
            setModel(model);
        };
        _getModel();
    }, []);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* <PackChart /> */}
            {model && links && (
                <ForceGraph
                    links={links}
                    rootModel={
                        model.campus.find(c =>
                            c.name.includes('eorge')
                        ) as Campus
                    }
                    rootModelType="campus"
                />
            )}
        </div>
    );
};

export default ChartPage;
