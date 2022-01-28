import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    capitalize,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { HierarchyNode } from 'd3-hierarchy';
import { SelectedModel } from '../../Visualizations/ForceGraph/ForceGraph';
import { DetailCard } from '../../Components';
import { groupBy, uniqueBy } from '../../util/util';
import getModel from '../../data/model';
import {
    ForceGraph,
    PackChart,
    ScrollableBarChart,
} from '../../Visualizations';
import { getEntityId, makeTree } from '../../util';
import {
    DSINode,
    isPerson,
    isProgram,
    isResource,
    ModelEntity,
} from '../../types';

const ChartPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [detailSelection, setDetailSelection] = useState<
        HierarchyNode<ModelEntity>[]
    >([]);
    const [model, setModel] = useState<ModelEntity[]>();
    const [root, setRoot] = useState<ModelEntity>();
    const [selected, setSelected] = useState<SelectedModel[]>([]);
    const [tree0, setTree0] = useState<HierarchyNode<ModelEntity>>();
    const [containerWidth, setContainerWidth] = useState<number>();
    const [keywordInputString, setKeywordInputString] = useState('');
    const [selectedKeyword, setSelectedKeyword] = useState('');
    const [nameSearchInputString, setNameSearchInputString] = useState('');

    const chartContainerRef = useCallback((node: HTMLDivElement) => {
        if (node) {
            setContainerWidth(Math.min(node.clientWidth, 800));
        }
    }, []);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
            setRoot(model.find(m => m.type === 'network'));
        };
        _getModel();
    }, []);

    /* base tree */
    useEffect(() => {
        if (model && root && !tree0) {
            setTree0(makeTree(model, root));
        }
    }, [model, root, tree0]);

    /* tree with latest root */
    const tree = useMemo(() => {
        if (tree0 && root) {
            return tree0.find(n => n.id === getEntityId(root))?.copy();
        }
    }, [tree0, root]);

    const getKeywords = (node: ModelEntity) =>
        isPerson(node)
            ? node.research_keywords || ''
            : isResource(node)
            ? node.keywords || ''
            : isProgram(node)
            ? node.key_words_tags || ''
            : '';

    const barChartKeywords = useMemo(() => {
        if (model) {
            const counts = Object.values(model)
                .flatMap(e =>
                    getKeywords(e)
                        .split(/[;,]/)
                        .map(d => d.trim().replace(/ +/g, ' '))
                )
                .filter(w => !!w && w.length < 40)
                .reduce<Record<string, number>>(
                    (acc, curr) => ({
                        ...acc,
                        [curr.toLowerCase()]: acc[curr.toLowerCase()]
                            ? acc[curr.toLowerCase()] + 1
                            : 1,
                    }),
                    {}
                );

            return Object.entries(counts)
                .filter(v => v[1] > 1)
                .map(([label, value]) => ({ label, value }));
        }
    }, [model]);

    const keywords = useMemo(() => {
        if (tree) {
            const keywords = tree
                .descendants()
                .flatMap(p => {
                    const keywords = getKeywords(p.data);
                    return keywords
                        .replace(/ +/g, ' ')
                        .split(/[,;]/)
                        .map(w => w.trim().toLowerCase());
                })
                .reduce<{ [key: string]: string[] }>(
                    (acc, curr) => ({
                        ...acc,
                        [curr]: acc[curr] ? acc[curr].concat(curr) : [curr],
                    }),
                    {}
                );

            return (
                Object.entries(keywords)
                    // filter out any singletons, which are often misspellings, whitespace-separated lists, etc.
                    .filter(a => a[1].length > 1)
                    .map(([k]) => k)
                    .filter(Boolean)
                    .sort((a, b) => (a === '' ? 1 : a < b ? -1 : 1))
            );
        }
    }, [tree]);

    const SelectableByKeyword = useMemo(() => {
        return tree
            ? tree
                  .descendants()
                  .filter(d => isPerson(d.data) && !!d.data.research_keywords)
                  .map(m => ({
                      keywords: getKeywords(m.data),
                      type: m.data.type,
                      id: m.data.id,
                  }))
            : [];
    }, [tree]);

    /* don't pass in nodes b/c autocomplete converts to JSON and you'll get circular errors */
    const names = useMemo(() => {
        if (tree) {
            return tree
                ?.descendants()
                .filter(uniqueBy(d => d.data.name))
                .map(v => v.data.name)
                .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
                .filter(Boolean);
        } else {
            return [];
        }
    }, [tree]);

    const nameMap = useMemo(() => {
        if (model) {
            return groupBy(model, 'name');
        } else {
            return {};
        }
    }, [model]);

    const resetKeywordInputs = () => {
        if (keywordInputString) {
            setKeywordInputString('');
        }
        if (selectedKeyword) {
            setSelectedKeyword('');
        }
        if (detailSelection.length) {
            setDetailSelection([]);
        }
    };

    const resetNameSearchInputs = () => {
        if (nameSearchInputString) {
            setNameSearchInputString('');
        }
        if (detailSelection.length) {
            setDetailSelection([]);
        }
    };

    return (
        <Grid container direction="column" spacing={3}>
            <Grid item container justifyContent="center">
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => {
                        setActiveTab(v);
                        if (model) {
                            setRoot(model.find(m => m.type === 'network'));
                        }
                    }}
                >
                    <Tab label="Tree View" />
                    <Tab label="Nested View" />
                    <Tab label="Scrollable Bar" />
                </Tabs>
            </Grid>
            {activeTab === 0 && (
                <Grid container direction="row" item spacing={3}>
                    <Grid
                        container
                        justifyContent="flex-end"
                        ref={chartContainerRef}
                        item
                        xs={9}
                    >
                        {tree && containerWidth && (
                            <ForceGraph
                                containerWidth={containerWidth}
                                selectedModels={selected}
                                selectedCallback={(node: DSINode) =>
                                    setDetailSelection(
                                        tree!
                                            .descendants()
                                            .filter(
                                                m =>
                                                    m.data.name ===
                                                    node.data.name
                                            )
                                    )
                                }
                                tree={tree}
                            />
                        )}
                    </Grid>
                    <Grid item xs={3} container direction="column" spacing={5}>
                        <Grid container direction="column" item spacing={2}>
                            <Grid item>
                                <FormControl fullWidth>
                                    <InputLabel htmlFor="root">Root</InputLabel>
                                    <Select
                                        id="root"
                                        onChange={e => {
                                            setRoot(
                                                (model || []).find(
                                                    m =>
                                                        e.target &&
                                                        getEntityId(m) ===
                                                            e.target.value
                                                )
                                            );
                                            setSelected([]);
                                            setDetailSelection([]);
                                        }}
                                        value={root ? getEntityId(root) : ''}
                                    >
                                        {(model || [])
                                            .filter(m =>
                                                [
                                                    'campus',
                                                    'institution',
                                                    'network',
                                                ].includes(m.type)
                                            )
                                            .sort((a, b) =>
                                                a.name.toLowerCase() <
                                                b.name.toLowerCase()
                                                    ? -1
                                                    : 1
                                            )
                                            .map(m => (
                                                <MenuItem
                                                    key={m.name}
                                                    value={getEntityId(m)}
                                                >
                                                    <Typography>
                                                        {m.name}
                                                    </Typography>
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    {tree && (
                                        <ChartPageAutocomplete
                                            label="Search by name or program"
                                            getOptionLabel={m => capitalize(m)}
                                            inputValue={nameSearchInputString}
                                            onInputChange={(value: string) => {
                                                setNameSearchInputString(value);
                                                resetKeywordInputs();
                                                value
                                                    ? setSelected(
                                                          tree
                                                              .descendants()
                                                              .filter(d =>
                                                                  d.data.name
                                                                      .toLowerCase()
                                                                      .includes(
                                                                          value.toLowerCase()
                                                                      )
                                                              )
                                                              .flatMap(
                                                                  v =>
                                                                      nameMap[
                                                                          v.data
                                                                              .name
                                                                      ]
                                                              )
                                                      )
                                                    : setSelected([]);
                                            }}
                                            onSelect={(value?: string) =>
                                                value &&
                                                setDetailSelection(
                                                    tree!
                                                        .descendants()
                                                        .filter(
                                                            m =>
                                                                m.data.name ===
                                                                value
                                                        )
                                                )
                                            }
                                            options={names}
                                            tree={tree}
                                            value={nameSearchInputString}
                                        />
                                    )}
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <FormControl fullWidth>
                                    {tree && keywords && (
                                        <ChartPageAutocomplete
                                            getOptionLabel={o => capitalize(o)}
                                            inputValue={keywordInputString}
                                            label="Search by keyword"
                                            onInputChange={(value: string) => {
                                                setKeywordInputString(value);
                                                resetNameSearchInputs();
                                                setSelected(
                                                    value
                                                        ? SelectableByKeyword.filter(
                                                              p =>
                                                                  p.keywords
                                                                      .toLowerCase()
                                                                      .includes(
                                                                          value.toLowerCase()
                                                                      )
                                                          ).map(p => ({
                                                              type: p.type,
                                                              id: p.id,
                                                          }))
                                                        : []
                                                );
                                            }}
                                            onSelect={selected =>
                                                setSelectedKeyword(
                                                    selected || ''
                                                )
                                            }
                                            options={keywords}
                                            tree={tree}
                                            value={selectedKeyword}
                                        />
                                    )}
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Grid item>
                            {!!detailSelection.length && (
                                <DetailCard nodes={detailSelection} />
                            )}
                        </Grid>
                    </Grid>
                </Grid>
            )}
            {activeTab === 1 && (
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {model && <PackChart entities={model} />}
                </Grid>
            )}
            {activeTab === 2 && (
                <Grid container justifyContent="center" sx={{ marginTop: 3 }}>
                    {barChartKeywords && (
                        <ScrollableBarChart data={barChartKeywords} />
                    )}
                </Grid>
            )}
        </Grid>
    );
};

interface ChartPageAutocompleteProps {
    getOptionLabel?: (option: string) => string;
    inputValue: string;
    onInputChange: (item: string) => void;
    onSelect?: (item?: string) => void;
    options: string[];
    label: string;
    tree: DSINode;
    value: string;
}

const ChartPageAutocomplete: React.FC<ChartPageAutocompleteProps> = ({
    getOptionLabel,
    inputValue,
    onInputChange,
    onSelect,
    options,
    label,
    tree,
    value,
}) => (
    <Autocomplete
        key={tree?.id}
        clearOnEscape
        freeSolo
        getOptionLabel={getOptionLabel}
        inputValue={inputValue}
        isOptionEqualToValue={(o, v) => o === v}
        onChange={(_, value, reason) => {
            if (onSelect) {
                if (reason === 'selectOption' && value) {
                    onSelect(value);
                }
                if (reason === 'clear') {
                    onSelect(undefined);
                }
            }
        }}
        onInputChange={(_, value) => onInputChange(value)}
        options={options}
        renderInput={params => <TextField {...params} label={label} />}
        value={value}
    />
);

export default ChartPage;
