import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Grid, TextField } from '@mui/material';
import getModel, {
    Campus,
    HydratedLink,
    hydrateLinks,
    Model,
} from './../../data/model';
import { ForceGraph, PackChart } from './../../Visualizations';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';

const ChartPage: React.FC<{}> = () => {
    const [links, setLinks] = useState<HydratedLink[]>();
    const [model, setModel] = useState<Model>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setLinks(hydrateLinks(model));
            setModel(model);
        };
        _getModel();
    }, []);

    const options = useMemo(() => {
        if (links) {
            return links
                .flatMap(l => [
                    { ...l.child, type: l.childType },
                    { ...l.parent, type: l.parentType },
                ])
                .filter(
                    (op, i, arr) =>
                        arr.findIndex(
                            inner =>
                                //inner.id === op.id && inner.type === op.type
                                inner.name === op.name
                        ) === i && op.name
                );
        } else {
            return [];
        }
    }, [links]);

    return (
        <Grid container>
            {/* <PackChart /> */}
            <Grid item xs={9}>
                {model && links && (
                    <ForceGraph
                        links={links}
                        rootModel={
                            model.campus.find(c =>
                                c.name.includes('eorge')
                            ) as Campus
                        }
                        rootModelType="campus"
                        selectedModels={selected}
                    />
                )}
            </Grid>
            <Grid item xs={3}>
                <Autocomplete
                    isOptionEqualToValue={(option, value) =>
                        option.name === value.name
                    }
                    renderInput={params => (
                        <TextField {...params} label="Search" />
                    )}
                    options={options}
                    onInputChange={(event, value, reason) =>
                        setSelected(
                            options
                                .filter(option => option.name.startsWith(value))
                                .map(op => ({ id: op.id, type: op.type }))
                        )
                    }
                    getOptionLabel={option =>
                        `${option.name}${
                            (option as any).campus
                                ? ` ${(option as any).campus}`
                                : ''
                        }`
                    }
                />
            </Grid>
        </Grid>
    );
};

export default ChartPage;
